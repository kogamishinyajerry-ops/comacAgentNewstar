import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { AgentFeedbackSchema } from "@/lib/llm/schema";
import { getStepConfig } from "@/lib/steps";
import {
  applyDecisionIntent,
  buildDecisionArtifact,
  decisionArtifactId,
  findDecisionArtifact,
  hasValidationEvent,
  intentAuditAction,
  parseDecisionArtifacts,
  upsertDecisionArtifact,
  withDecisionArtifacts,
} from "@/lib/agent-collaboration/decision";
import type {
  DecisionActor,
  DecisionArtifact,
  DecisionEvidence,
} from "@/lib/agent-collaboration/types";

const Body = z
  .object({
    step: z.number().int().min(1).max(10),
    feedbackId: z.string().trim().min(1).max(120),
    suggestionIndex: z.number().int().min(0).max(2),
    intent: z.enum(["approve", "modify", "question", "defer", "validate", "signoff"]),
    rationale: z.string().trim().max(600).optional(),
    modifiedProposal: z.string().trim().max(1600).optional(),
    validationFeedbackId: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.intent === "modify" && !value.modifiedProposal) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["modifiedProposal"], message: "请填写人工修改版本" });
    }
    if (["question", "defer"].includes(value.intent) && !value.rationale) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["rationale"], message: "请记录质疑或暂缓理由" });
    }
    if (value.intent === "validate" && !value.validationFeedbackId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["validationFeedbackId"], message: "缺少 Coach 复核记录" });
    }
  });

function parseStageData(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function suggestionStateFor(intent: z.infer<typeof Body>["intent"]): string | null {
  if (intent === "approve" || intent === "modify") return "adopted";
  if (intent === "signoff") return "done";
  return null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "决策参数错误");
  }
  const input = parsed.data;

  const feedback = await prisma.agentFeedback.findUnique({
    where: { id: input.feedbackId },
    include: { session: true },
  });
  if (!feedback || feedback.projectId !== params.id || feedback.step !== input.step) {
    return jsonError(404, "对应的 Agent 建议不存在");
  }

  const feedbackResult = AgentFeedbackSchema.safeParse(JSON.parse(feedback.content));
  if (!feedbackResult.success) return jsonError(409, "Agent 建议结构已失效，请重新诊断");
  const suggestion = feedbackResult.data.suggestions[input.suggestionIndex];
  if (!suggestion) return jsonError(404, "对应的 Agent 建议不存在");

  const stageRow = await prisma.stageResponse.findUnique({
    where: { projectId_step: { projectId: params.id, step: input.step } },
  });
  const stageData = parseStageData(stageRow?.data);
  const artifacts = parseDecisionArtifacts(stageData);
  const existing = findDecisionArtifact(artifacts, feedback.id, input.suggestionIndex);

  if (!existing && (input.intent === "validate" || input.intent === "signoff")) {
    return jsonError(409, "请先批准、修改或质疑这项建议");
  }
  if (existing?.state === "verified" && input.intent !== "signoff") {
    return jsonError(409, "该决定已签收；如需改变，请生成新的 Agent 建议版本");
  }

  let validationFeedbackId: string | undefined;
  if (input.intent === "validate") {
    const validationFeedback = await prisma.agentFeedback.findUnique({
      where: { id: input.validationFeedbackId },
    });
    if (
      !validationFeedback ||
      validationFeedback.projectId !== params.id ||
      validationFeedback.step !== input.step ||
      validationFeedback.createdAt < feedback.createdAt
    ) {
      return jsonError(409, "Coach 复核记录与当前决定不匹配");
    }
    if (!existing || !["approved", "executed"].includes(existing.state)) {
      return jsonError(409, "只有已批准并写入的决定才能请求复核");
    }
    validationFeedbackId = validationFeedback.id;
  }

  if (input.intent === "signoff" && existing && !hasValidationEvent(existing)) {
    return jsonError(409, "请先让 Coach 复核，再由你完成签收");
  }

  const stageTitle = getStepConfig(input.step)?.title ?? `阶段 ${input.step}`;
  const attachments = await prisma.attachment.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const evidence: DecisionEvidence[] = [
    {
      id: `stage:${params.id}:${input.step}`,
      kind: "stage",
      label: `${stageTitle} · 当前阶段 Artifact`,
      version: stageRow ? `更新于 ${stageRow.updatedAt.toISOString()}` : "尚无正式字段版本",
    },
    {
      id: `feedback:${feedback.id}`,
      kind: "feedback",
      label: `AI 导师诊断 · ${feedback.session.promptVersionLabel ?? "提示词版本待记录"}`,
      version: `${feedback.session.provider}/${feedback.session.model}`,
    },
    ...attachments.map((attachment) => ({
      id: `attachment:${attachment.id}`,
      kind: "attachment" as const,
      label: attachment.title,
      href: attachment.kind === "FILE" ? `/api/attachments/${attachment.id}/download` : attachment.url,
      version: attachment.createdAt.toISOString(),
    })),
  ];

  const baseArtifact: DecisionArtifact =
    existing ??
    buildDecisionArtifact({
      projectId: params.id,
      subjectRef: `project:${params.id}:stage:${input.step}`,
      stage: input.step,
      title: suggestion.title,
      proposal: suggestion.action,
      reasons: uniqueStrings([suggestion.why, feedbackResult.data.summary]),
      evidence,
      assumptions: feedbackResult.data.critical_gaps.map((gap) => `${gap.field}：${gap.reason}`),
      uncertainties: feedbackResult.data.risk_flags.map((risk) => risk.message),
      impacts: [
        `系统会把本次决定写入“${stageTitle}”的协作记录。`,
        "不会自动提交作品、修改其他正式字段或执行外部工具。",
      ],
      authorityLevel: "suggest",
      feedbackId: feedback.id,
      suggestionIndex: input.suggestionIndex,
      agentId: `agent:${feedback.session.id}`,
      agentName: "AI 导师 Coach",
      createdAt: feedback.createdAt.toISOString(),
    });

  const actor: DecisionActor =
    input.intent === "validate"
      ? { id: `agent:${feedback.session.id}`, name: "AI 导师 Coach", type: "agent" }
      : { id: access.user.id, name: access.user.name, type: "human" };

  let artifact: DecisionArtifact;
  try {
    artifact = applyDecisionIntent({
      artifact: baseArtifact,
      intent: input.intent,
      actor,
      timestamp: new Date().toISOString(),
      rationale: input.rationale,
      modifiedProposal: input.modifiedProposal,
      validationFeedbackId,
    });
  } catch (error) {
    return jsonError(400, error instanceof Error ? error.message : "无法应用这项决定");
  }

  const nextArtifacts = upsertDecisionArtifact(artifacts, artifact);
  const nextStageData = withDecisionArtifacts(stageData, nextArtifacts);
  const nextSuggestionState = suggestionStateFor(input.intent);

  await prisma.$transaction(async (tx) => {
    await tx.stageResponse.upsert({
      where: { projectId_step: { projectId: params.id, step: input.step } },
      update: { data: JSON.stringify(nextStageData) },
      create: { projectId: params.id, step: input.step, data: JSON.stringify(nextStageData) },
    });

    if (nextSuggestionState) {
      let states: Record<string, string> = {};
      try {
        states = JSON.parse(feedback.suggestionStates) as Record<string, string>;
      } catch {
        states = {};
      }
      states[String(input.suggestionIndex)] = nextSuggestionState;
      await tx.agentFeedback.update({
        where: { id: feedback.id },
        data: { suggestionStates: JSON.stringify(states) },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: access.user.id,
        actorName: access.user.name,
        action: intentAuditAction(input.intent),
        targetType: "DecisionArtifact",
        targetId: decisionArtifactId(feedback.id, input.suggestionIndex),
        detail: JSON.stringify({
          projectId: params.id,
          step: input.step,
          feedbackId: feedback.id,
          suggestionIndex: input.suggestionIndex,
          state: artifact.state,
          version: artifact.version,
          requestId: randomUUID(),
        }),
      },
    });
  });

  return Response.json({ ok: true, artifact });
}

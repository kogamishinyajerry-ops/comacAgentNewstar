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

function parseAgentFeedback(raw: string) {
  try {
    return AgentFeedbackSchema.safeParse(JSON.parse(raw) as unknown);
  } catch {
    return AgentFeedbackSchema.safeParse(null);
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

function parseSuggestionStates(raw: string): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
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

  const feedbackResult = parseAgentFeedback(feedback.content);
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
  if (existing?.state === "verified") {
    return jsonError(409, "该决定已经签收；如需改变，请生成新的 Agent 建议版本");
  }

  let validationFeedbackId: string | undefined;
  let validationAgentId = `agent:${feedback.session.id}`;
  if (input.intent === "validate") {
    const validationFeedback = await prisma.agentFeedback.findUnique({
      where: { id: input.validationFeedbackId },
      include: { session: true },
    });
    if (
      !validationFeedback ||
      validationFeedback.projectId !== params.id ||
      validationFeedback.step !== input.step ||
      validationFeedback.createdAt <= feedback.createdAt
    ) {
      return jsonError(409, "Coach 复核记录与当前决定不匹配");
    }
    if (!existing || !["approved", "executed"].includes(existing.state)) {
      return jsonError(409, "只有已批准并写入的决定才能请求复核");
    }
    if (!["OK", "REPAIRED"].includes(validationFeedback.session.status)) {
      return jsonError(409, "本轮 Coach 运行未形成可采信的复核结果，请重试");
    }
    validationFeedbackId = validationFeedback.id;
    validationAgentId = `agent:${validationFeedback.session.id}`;
  }

  if (input.intent === "signoff" && existing && !hasValidationEvent(existing)) {
    return jsonError(409, "请先让 Coach 复核，再由你完成签收");
  }

  const stageTitle = getStepConfig(input.step)?.title ?? `阶段 ${input.step}`;
  // 只把本轮 Agent 实际读取的上下文登记为依据。当前 Coach 上下文没有读取附件，
  // 因此附件不能仅因“存在于项目中”就被伪装成支持本结论的 Evidence。
  const evidence: DecisionEvidence[] = [
    {
      id: `stage:${params.id}:${input.step}`,
      kind: "stage",
      label: `${stageTitle} · 本轮读取的阶段 Artifact`,
      version: stageRow ? `更新于 ${stageRow.updatedAt.toISOString()}` : "本轮读取为空白阶段",
    },
    {
      id: `feedback:${feedback.id}`,
      kind: "feedback",
      label: "AI 导师结构化诊断",
      version: feedback.createdAt.toISOString(),
    },
    {
      id: `run:${feedback.session.id}`,
      kind: "run",
      label: `Agent Run · ${feedback.session.provider}/${feedback.session.model}`,
      version: `${feedback.session.promptVersionLabel ?? "prompt-unversioned"} · ${feedback.session.status}`,
    },
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
      ? { id: validationAgentId, name: "AI 导师 Coach", type: "agent" }
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
    return jsonError(409, error instanceof Error ? error.message : "无法应用这项决定");
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
      const states = parseSuggestionStates(feedback.suggestionStates);
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
          initiatedBy: access.user.id,
          semanticActorId: actor.id,
          validationFeedbackId,
          requestId: randomUUID(),
        }),
      },
    });
  });

  return Response.json({ ok: true, artifact });
}

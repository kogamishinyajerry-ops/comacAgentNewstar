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

function uniqueEvidence(values: DecisionEvidence[]): DecisionEvidence[] {
  const byId = new Map<string, DecisionEvidence>();
  for (const value of values) byId.set(value.id, value);
  return Array.from(byId.values());
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
  let validationEvidence: DecisionEvidence[] = [];
  if (input.intent === "validate") {
    if (!existing || !["approved", "executed"].includes(existing.state)) {
      return jsonError(409, "只有已批准并写入的决定才能请求复核");
    }
    const decisionWrittenAt = new Date(existing.updatedAt);
    if (Number.isNaN(decisionWrittenAt.getTime())) {
      return jsonError(409, "当前决定版本时间无效，请重新生成建议");
    }

    const validationFeedback = await prisma.agentFeedback.findUnique({
      where: { id: input.validationFeedbackId },
      include: { session: true },
    });
    if (
      !validationFeedback ||
      validationFeedback.projectId !== params.id ||
      validationFeedback.step !== input.step ||
      validationFeedback.session.purpose !== "COACH" ||
      validationFeedback.createdAt <= decisionWrittenAt
    ) {
      return jsonError(409, "必须使用批准后新产生的本阶段 Coach 复核记录");
    }
    if (!["OK", "REPAIRED"].includes(validationFeedback.session.status)) {
      return jsonError(409, "本轮 Coach 运行未形成可采信的复核结果，请重试");
    }
    const validationResult = parseAgentFeedback(validationFeedback.content);
    if (!validationResult.success) {
      return jsonError(409, "Coach 复核反馈结构无效，请重试");
    }

    validationFeedbackId = validationFeedback.id;
    validationAgentId = `agent:${validationFeedback.session.id}`;
    validationEvidence = [
      {
        id: `feedback:${validationFeedback.id}`,
        kind: "feedback",
        label: "Coach 复核反馈",
        excerpt: validationResult.data.summary,
        version: validationFeedback.createdAt.toISOString(),
      },
      {
        id: `run:${validationFeedback.session.id}`,
        kind: "run",
        label: `Validation Run · ${validationFeedback.session.provider}/${validationFeedback.session.model}`,
        version: `${validationFeedback.session.promptVersionLabel ?? "prompt-unversioned"} · ${validationFeedback.session.status}`,
      },
    ];
  }

  if (input.intent === "signoff" && existing && !hasValidationEvent(existing)) {
    return jsonError(409, "请先让 Coach 复核，再由你完成签收");
  }

  const stageTitle = getStepConfig(input.step)?.title ?? `阶段 ${input.step}`;
  // 当前数据库没有保存 Agent 运行时输入的不可变快照或哈希。
  // 因此这里只登记可被准确重建的结构化反馈与具体 Run，不把“当前阶段值”
  // 或“项目里存在的附件”冒充为本轮已经使用的证据。
  const sourceEvidence: DecisionEvidence[] = [
    {
      id: `feedback:${feedback.id}`,
      kind: "feedback",
      label: "AI 导师结构化诊断",
      excerpt: feedbackResult.data.summary,
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
      evidence: sourceEvidence,
      assumptions: feedbackResult.data.critical_gaps.map((gap) => `${gap.field}：${gap.reason}`),
      uncertainties: uniqueStrings([
        ...feedbackResult.data.risk_flags.map((risk) => risk.message),
        "当前版本未保存 Agent 运行时上下文的不可变快照或哈希，无法逐字段重建本轮输入版本。",
      ]),
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

  const artifactForIntent: DecisionArtifact = validationEvidence.length
    ? {
        ...baseArtifact,
        evidence: uniqueEvidence([...baseArtifact.evidence, ...validationEvidence]),
      }
    : baseArtifact;

  const actor: DecisionActor =
    input.intent === "validate"
      ? { id: validationAgentId, name: "AI 导师 Coach", type: "agent" }
      : { id: access.user.id, name: access.user.name, type: "human" };

  let artifact: DecisionArtifact;
  try {
    artifact = applyDecisionIntent({
      artifact: artifactForIntent,
      intent: input.intent,
      actor,
      timestamp: new Date().toISOString(),
      rationale: input.rationale,
      modifiedProposal: input.modifiedProposal,
      validationFeedbackId,
    });
    if (input.intent === "validate" && validationEvidence.length) {
      const validationRefs = validationEvidence.map((item) => item.id);
      artifact = {
        ...artifact,
        events: artifact.events.map((event, index, events) =>
          index === events.length - 1 && event.action === "validated"
            ? { ...event, evidenceRefs: validationRefs }
            : event,
        ),
      };
    }
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
          evidenceRefs: artifact.events.at(-1)?.evidenceRefs ?? [],
          requestId: randomUUID(),
        }),
      },
    });
  });

  return Response.json({ ok: true, artifact });
}

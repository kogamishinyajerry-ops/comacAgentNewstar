// Agent 编排:组装上下文 → 调用 Provider → 校验/一次修复/降级 → 持久化会话与反馈

import { prisma } from "../db";
import { AgentFeedbackSchema, fallbackFeedback, normalizeFeedback, type AgentFeedback } from "./schema";
import { coerceFeedbackShape, tryParseJson } from "./repair";
import { GLMProvider } from "./glm";
import { MockProvider } from "./mock";
import { isMockEnabled, llmConfig } from "./provider";
import { COACH_SYSTEM_PROMPT, PRECHECK_SYSTEM_PROMPT } from "../prompts";
import { getStepConfig } from "../steps";
import { getStageData, validateTestCases } from "../validation";
import { TRACKS } from "../constants";
import type { ProjectBundle } from "../projects";

export interface CoachRunResult {
  feedback: AgentFeedback;
  sessionId: string;
  feedbackId: string;
  status: "OK" | "REPAIRED" | "FALLBACK" | "ERROR";
  provider: string;
  model: string;
}

const MAX_FIELD_CHARS = 600;

function truncate(v: unknown): unknown {
  if (typeof v === "string" && v.length > MAX_FIELD_CHARS) return v.slice(0, MAX_FIELD_CHARS) + "…";
  return v;
}

/** 生成阶段摘要而不是把全部历史塞进上下文 */
export function buildUserContext(bundle: ProjectBundle, step: number, purpose: "COACH" | "PRECHECK"): string {
  const cfg = getStepConfig(step);
  const stageSummary: Record<number, Record<string, unknown>> = {};
  for (const s of [1, 4, 5, 6]) {
    const d = getStageData(bundle.stages, s);
    const trimmed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) trimmed[k] = truncate(v);
    stageSummary[s] = trimmed;
  }
  const payload = {
    purpose,
    current_step: step,
    step_title: cfg?.title,
    step_focus: cfg?.coachFocus,
    project: {
      title: bundle.project.title,
      track: bundle.project.track ? TRACKS.find((t) => t.key === bundle.project.track)?.name : null,
      status: bundle.project.status,
    },
    team: {
      mode: bundle.team.mode,
      member_count: bundle.team.memberCount,
      start_time: bundle.team.startTime,
      existing_base: truncate(bundle.team.existingBase),
      added_during_activity: truncate(bundle.team.addedDuringActivity),
      external_resources: truncate(bundle.team.externalResources),
      helpers: bundle.team.helpers,
    },
    stages_summary: stageSummary,
    test_cases: {
      count: bundle.testCases.length,
      coverage_errors: validateTestCases(bundle.testCases).errors.map((e) => e.reason).slice(0, 5),
      items: bundle.testCases.map((t) => ({
        name: t.name,
        type: t.type,
        verdict: t.verdict,
        has_actual: !!t.actual,
        has_failure_reason: !!t.failureReason,
      })),
    },
  };
  return JSON.stringify(payload);
}

function getProvider() {
  if (isMockEnabled()) return new MockProvider();
  const cfg = llmConfig();
  if (cfg.provider !== "glm") return new MockProvider();
  return new GLMProvider();
}

async function getActivePrompt(purpose: "COACH" | "PRECHECK"): Promise<{ system: string; label: string }> {
  const row = await prisma.promptVersion.findFirst({
    where: { purpose, active: true },
    orderBy: { createdAt: "desc" },
  });
  if (row) return { system: row.systemPrompt, label: row.version };
  return {
    system: purpose === "COACH" ? COACH_SYSTEM_PROMPT : PRECHECK_SYSTEM_PROMPT,
    label: "builtin-fallback",
  };
}

export async function runAgent(params: {
  bundle: ProjectBundle;
  step: number;
  purpose: "COACH" | "PRECHECK";
}): Promise<CoachRunResult> {
  const { bundle, step, purpose } = params;
  const provider = getProvider();
  const { system, label } = await getActivePrompt(purpose);

  const isMock = provider instanceof MockProvider;
  const userMessage = isMock
    ? JSON.stringify({ mockContext: { bundle, step, purpose } })
    : buildUserContext(bundle, step, purpose);

  const started = Date.now();
  let status: CoachRunResult["status"] = "OK";
  let feedback: AgentFeedback | null = null;
  let rawText = "";
  let error: string | null = null;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  try {
    const result = await provider.chatJSON({ system, user: userMessage });
    rawText = result.text;
    promptTokens = result.promptTokens;
    completionTokens = result.completionTokens;

    const direct = tryParseJson(rawText, false);
    const parsedDirect = direct ? AgentFeedbackSchema.safeParse(coerceFeedbackShape(direct)) : null;
    if (parsedDirect?.success) {
      feedback = normalizeFeedback(parsedDirect.data);
    } else {
      // 一次自动修复
      const repaired = tryParseJson(rawText, true);
      const parsedRepaired = repaired ? AgentFeedbackSchema.safeParse(coerceFeedbackShape(repaired)) : null;
      if (parsedRepaired?.success) {
        status = "REPAIRED";
        feedback = normalizeFeedback(parsedRepaired.data);
      } else {
        status = "FALLBACK";
        feedback = fallbackFeedback(rawText);
      }
    }
  } catch (e) {
    status = "ERROR";
    error = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
    feedback = fallbackFeedback("");
  }

  const latencyMs = Date.now() - started;

  const session = await prisma.agentSession.create({
    data: {
      projectId: bundle.project.id,
      step,
      purpose,
      provider: provider.name,
      model: provider.model,
      promptVersionLabel: label,
      status,
      latencyMs,
      promptTokens: promptTokens ?? null,
      completionTokens: completionTokens ?? null,
      error,
    },
  });

  const feedbackRow = await prisma.agentFeedback.create({
    data: {
      sessionId: session.id,
      projectId: bundle.project.id,
      step,
      content: JSON.stringify(feedback),
    },
  });

  if (status !== "ERROR") {
    await prisma.tokenUsage.create({
      data: {
        sessionId: session.id,
        provider: provider.name,
        model: provider.model,
        promptTokens: promptTokens ?? Math.ceil(userMessage.length / 4),
        completionTokens: completionTokens ?? Math.ceil(rawText.length / 4),
        totalTokens:
          (promptTokens ?? Math.ceil(userMessage.length / 4)) + (completionTokens ?? Math.ceil(rawText.length / 4)),
        latencyMs,
        ok: true,
      },
    });
  } else {
    await prisma.tokenUsage.create({
      data: {
        sessionId: session.id,
        provider: provider.name,
        model: provider.model,
        latencyMs,
        ok: false,
      },
    });
  }

  return { feedback, sessionId: session.id, feedbackId: feedbackRow.id, status, provider: provider.name, model: provider.model };
}

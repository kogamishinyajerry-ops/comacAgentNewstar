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
import { parseDecisionArtifacts } from "../agent-collaboration/decision";
import { DECISION_ARTIFACTS_KEY } from "../agent-collaboration/types";
import type { ProjectBundle } from "../projects";

export interface CoachRunResult {
  feedback: AgentFeedback;
  sessionId: string;
  feedbackId: string;
  status: "OK" | "REPAIRED" | "FALLBACK" | "ERROR";
  provider: string;
  model: string;
  promptVersionLabel: string;
  latencyMs: number;
}

const MAX_FIELD_CHARS = 600;

function truncate(v: unknown): unknown {
  if (typeof v === "string" && v.length > MAX_FIELD_CHARS) return v.slice(0, MAX_FIELD_CHARS) + "…";
  return v;
}

function truncateStrings(values: string[], limit = 4): string[] {
  return values.slice(0, limit).map((value) => String(truncate(value)));
}

/**
 * 生成可控的 Agent 上下文而不是倾倒全部历史。
 *
 * 当前实现会显式包含本轮阶段与结构化 Decision Artifact，使“Coach 复核”
 * 在所有十个阶段都能看到它正在复核的对象。运行时上下文尚未持久化为不可变
 * 快照或哈希，因此该边界也会随 payload 一起告知模型和前台。
 */
export function buildUserContext(
  bundle: ProjectBundle,
  step: number,
  purpose: "COACH" | "PRECHECK",
  qa: { q: string; a: string }[] = [],
): string {
  const cfg = getStepConfig(step);
  const stageSummary: Record<number, Record<string, unknown>> = {};
  const contextSteps = Array.from(new Set([1, 4, 5, 6, step])).sort((a, b) => a - b);

  for (const stageStep of contextSteps) {
    const data = getStageData(bundle.stages, stageStep);
    const trimmed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Decision Artifact 以单独的语义对象进入上下文，避免在普通字段里重复或无限膨胀。
      if (key === DECISION_ARTIFACTS_KEY) continue;
      trimmed[key] = truncate(value);
    }
    stageSummary[stageStep] = trimmed;
  }

  const currentDecisions = parseDecisionArtifacts(getStageData(bundle.stages, step))
    .slice(0, 3)
    .map((decision) => ({
      id: decision.id,
      title: String(truncate(decision.title)),
      proposal: String(truncate(decision.proposal)),
      original_proposal: String(truncate(decision.originalProposal)),
      human_revision: decision.humanRevision ? String(truncate(decision.humanRevision)) : null,
      state: decision.state,
      version: decision.version,
      uncertainties: truncateStrings(decision.uncertainties),
      impacts: truncateStrings(decision.impacts),
      recent_events: decision.events.slice(-6).map((event) => ({
        actor_type: event.actorType,
        actor_name: event.actorName,
        action: event.action,
        after_state: event.afterState,
        rationale: event.rationale ? String(truncate(event.rationale)) : null,
        timestamp: event.timestamp,
      })),
    }));

  const payload = {
    purpose,
    current_step: step,
    step_title: cfg?.title,
    step_focus: cfg?.coachFocus,
    project: {
      title: bundle.project.title,
      track: bundle.project.track ? TRACKS.find((track) => track.key === bundle.project.track)?.name : null,
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
    current_decisions: currentDecisions,
    test_cases: {
      count: bundle.testCases.length,
      coverage_errors: validateTestCases(bundle.testCases).errors.map((error) => error.reason).slice(0, 5),
      items: bundle.testCases.map((testCase) => ({
        name: testCase.name,
        type: testCase.type,
        verdict: testCase.verdict,
        has_actual: !!testCase.actual,
        has_failure_reason: !!testCase.failureReason,
      })),
    },
    recent_qa: qa,
    context_boundary: {
      immutable_input_snapshot_persisted: false,
      note: "当前版本未保存本轮 Agent 输入上下文的不可变快照或哈希；不要声称可逐字段重放当时输入。",
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

/** 近几轮追问的问答(供追问演进:不重复问,针对回答深挖) */
async function recentQA(projectId: string): Promise<{ q: string; a: string }[]> {
  const rows = await prisma.agentFeedback.findMany({
    where: { projectId, answers: { not: "{}" } },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const qa: { q: string; a: string }[] = [];
  for (const row of rows) {
    try {
      const answers = JSON.parse(row.answers) as Record<string, string>;
      const content = JSON.parse(row.content) as { questions?: (string | { q?: string })[] };
      for (const [index, answer] of Object.entries(answers)) {
        if (!answer || !answer.trim()) continue;
        const question = content.questions?.[Number(index)];
        const questionText = typeof question === "string" ? question : question?.q;
        if (questionText) qa.push({ q: questionText, a: answer });
      }
    } catch {
      /* ignore malformed historical QA */
    }
  }
  return qa.slice(0, 5);
}

export async function runAgent(params: {
  bundle: ProjectBundle;
  step: number;
  purpose: "COACH" | "PRECHECK";
}): Promise<CoachRunResult> {
  const { bundle, step, purpose } = params;
  const provider = getProvider();
  const { system, label } = await getActivePrompt(purpose);
  const qa = await recentQA(bundle.project.id);

  const isMock = provider instanceof MockProvider;
  const userMessage = isMock
    ? JSON.stringify({ mockContext: { bundle, step, purpose, answers: qa } })
    : buildUserContext(bundle, step, purpose, qa);

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
  } catch (caught) {
    status = "ERROR";
    error = caught instanceof Error ? caught.message.slice(0, 500) : String(caught).slice(0, 500);
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
          (promptTokens ?? Math.ceil(userMessage.length / 4)) +
          (completionTokens ?? Math.ceil(rawText.length / 4)),
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

  return {
    feedback,
    sessionId: session.id,
    feedbackId: feedbackRow.id,
    status,
    provider: provider.name,
    model: provider.model,
    promptVersionLabel: label,
    latencyMs,
  };
}

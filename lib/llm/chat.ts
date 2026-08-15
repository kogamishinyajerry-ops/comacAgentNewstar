// 对话式工作台编排:用户消息 → (GLM提取 | 离线大脑) → 结构化落库 → Agent回复

import { prisma } from "../db";
import { getStepConfig } from "../steps";
import { getStageData } from "../validation";
import { TRACKS } from "../constants";
import { loadProjectBundle } from "../projects";
import { computeProjectProgress } from "../progress";
import { GLMProvider } from "./glm";
import { MockProvider } from "./mock";
import { isMockEnabled, llmConfig, checkRateLimit } from "./provider";
import { tryParseJson } from "./repair";
import { CHAT_SYSTEM_PROMPT } from "../prompts";
import { chatTurn, parseFocus, EXPECT_PENDING, type ChatTurn, type ParsedTestCase } from "./chat-brain";

const TEAM_KEYS = ["startTime", "existingBase", "addedDuringActivity", "externalResources", "helpers"];

interface GlmChatOut {
  reply?: string;
  updates?: { step?: number; key?: string; value?: unknown }[];
  next_target?: { step?: number; key?: string } | null;
  grill?: { q?: string; why?: string } | null;
  action?: string | null;
  test_case?: Record<string, unknown> | null;
}

function sanitizeGlm(out: GlmChatOut, allowed: { step: number; keys: string[] }[]): ChatTurn["updates"] {
  const updates: ChatTurn["updates"] = [];
  for (const u of out.updates ?? []) {
    const step = Number(u.step);
    const key = typeof u.key === "string" ? u.key : "";
    const value = typeof u.value === "string" ? u.value.trim().slice(0, 800) : "";
    const slot = allowed.find((a) => a.step === step && a.keys.includes(key));
    if (slot && value) updates.push({ step, key, value });
  }
  return updates.slice(0, 4);
}

/** GLM 口述提取的 test_case → 受信任的 ParsedTestCase(枚举/长度全白名单化) */
function sanitizeTestCase(raw: unknown): ParsedTestCase | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const type = (["NORMAL", "BOUNDARY", "FAILURE", "NA"] as const).includes(r.type as never)
    ? (r.type as ParsedTestCase["type"])
    : "NORMAL";
  const input = String(r.input ?? "").trim().slice(0, 2000);
  if (!input) return null;
  const expected = String(r.expected ?? "").trim().slice(0, 2000) || EXPECT_PENDING;
  return {
    name: String(r.name ?? "").trim().slice(0, 80) || "未命名案例",
    type,
    input,
    expected,
    failureReason: String(r.failure_reason ?? "").trim().slice(0, 1000),
  };
}

export async function runChatTurn(params: { projectId: string; message: string; userId: string; focus?: string }): Promise<
  | { ok: true; user: ChatMsgView; agent: ChatMsgView; progress: ReturnType<typeof computeProjectProgress> }
  | { ok: false; error: string; status: number }
> {
  const { projectId, message, userId } = params;
  if (!checkRateLimit(userId, 20)) return { ok: false, error: "聊得太快了,喘口气", status: 429 };

  const bundle = await loadProjectBundle(projectId);
  if (!bundle) return { ok: false, error: "项目不存在", status: 404 };
  const project = await prisma.ideaProject.findUnique({ where: { id: projectId } });
  if (!project || !["DRAFT", "RETURNED"].includes(project.status)) {
    return { ok: false, error: "当前状态不能编辑(已提交/归档)", status: 409 };
  }

  // 上一轮Agent的目标字段("到对话中重说"的 focus 优先)
  const focused = parseFocus(params.focus);
  const lastAgent = await prisma.chatMessage.findFirst({ where: { projectId, role: "agent" }, orderBy: { createdAt: "desc" } });
  let lastTarget: { step: number; key: string } | null = focused;
  if (!lastTarget) {
    try {
      const meta = JSON.parse(lastAgent?.meta || "{}") as { nextTarget?: { step: number; key: string } };
      if (meta.nextTarget?.key) lastTarget = { step: meta.nextTarget.step, key: meta.nextTarget.key };
    } catch {
      /* ignore */
    }
  }

  const userMsg = await prisma.chatMessage.create({ data: { projectId, role: "user", content: message.slice(0, 4000) } });

  const teamRecord = bundle.team as unknown as Record<string, unknown>;
  let turn: ChatTurn;

  // GLM模式:自然语言提取(结构步骤1-3与"重说"焦点交给离线大脑,确定性强)
  let provider: { name: string; chatJSON: (p: { system: string; user: string }) => Promise<{ text: string }> } | null = null;
  if (!isMockEnabled() && !focused) provider = new GLMProvider();

  if (provider) {
    try {
      const allowed = [4, 5, 6].map((step) => ({ step, keys: getStepConfig(step)!.fields.map((f) => f.key) }));
      const emptyNow = allowed
        .map((a) => {
          const data = getStageData(bundle.stages, a.step);
          return a.keys.filter((k) => !String(data[k] ?? "").trim()).map((k) => `${a.step}.${k}`);
        })
        .flat()
        .slice(0, 14);
      const cases = bundle.testCases ?? [];
      const testSummary = {
        已收集: cases.length,
        需覆盖: ["常规", "边界/复杂", "失败或不适用"],
        邀请口述: emptyNow.length === 0 && cases.length < 5,
      };
      const ctx = JSON.stringify({
        目标: "把用户的回答提取进材料字段,并以面试官身份继续追问(一次只问一个)",
        空缺字段: emptyNow,
        上一问: lastTarget ? `${lastTarget.step}.${lastTarget.key}` : null,
        测试现状: testSummary,
        用户消息: message.slice(0, 1200),
        追问规则: "先答后问:先简短确认已记录,再就最重要的下一个空缺提出一个具体问题(≤40字);发现漏洞要点破(估的数字/无裁决依据/AI越界)",
      });
      const res = await provider.chatJSON({ system: CHAT_SYSTEM_PROMPT, user: ctx });
      const out = (tryParseJson(res.text, true) ?? {}) as GlmChatOut;
      const updates = sanitizeGlm(out, allowed);
      const tc = sanitizeTestCase(out.test_case);
      if (tc && (bundle.testCases ?? []).length < 30) updates.push({ step: 8, key: "testCase", value: tc });
      const brainFallback = chatTurn({ bundle, team: teamRecord, lastTarget, message });
      turn = {
        reply: (out.reply && String(out.reply).slice(0, 300)) || brainFallback.reply,
        updates: updates.length ? updates : brainFallback.updates,
        nextTarget: tc && !brainFallback.nextTarget ? { step: 8, key: "testCase", label: "测试案例" } : brainFallback.nextTarget,
        grill: out.grill?.q ? { q: out.grill.q.slice(0, 160), why: (out.grill.why ?? "").slice(0, 120) } : null,
        action: brainFallback.action,
      };
    } catch {
      turn = chatTurn({ bundle, team: teamRecord, lastTarget, message });
    }
  } else {
    turn = chatTurn({ bundle, team: teamRecord, lastTarget, message });
  }

  // 落库updates
  for (const u of turn.updates) {
    if (u.step === 1) {
      const merged = { ...getStageData(bundle.stages, 1), agreeRules: true, agreeDataSafety: true, agreeOriginality: true };
      await prisma.stageResponse.upsert({
        where: { projectId_step: { projectId, step: 1 } },
        update: { data: JSON.stringify(merged) },
        create: { projectId, step: 1, data: JSON.stringify(merged) },
      });
    } else if (u.step === 2 && TEAM_KEYS.includes(u.key) && typeof u.value === "string") {
      await prisma.team.update({ where: { id: bundle.team.id }, data: { [u.key]: u.value } });
    } else if (u.step === 3 && typeof u.value === "string") {
      const key = TRACKS.find((t) => t.name === u.value || t.key === u.value)?.key;
      if (key) await prisma.ideaProject.update({ where: { id: projectId }, data: { track: key } });
    } else if ([4, 5, 6].includes(u.step) && typeof u.value === "string") {
      const merged = { ...getStageData(bundle.stages, u.step), [u.key]: u.value };
      await prisma.stageResponse.upsert({
        where: { projectId_step: { projectId, step: u.step } },
        update: { data: JSON.stringify(merged) },
        create: { projectId, step: u.step, data: JSON.stringify(merged) },
      });
    } else if (u.step === 8 && u.key === "testCase" && typeof u.value === "object" && u.value !== null) {
      // 口述测试:追加一行(绝不整体覆盖表格),上限30例与服务端一致
      const count = await prisma.testCase.count({ where: { projectId } });
      if (count < 30) {
        const tc = u.value as ParsedTestCase;
        await prisma.testCase.create({
          data: {
            projectId,
            sortOrder: count,
            name: tc.name.slice(0, 80),
            type: tc.type,
            input: tc.input.slice(0, 2000),
            expected: tc.expected.slice(0, 2000),
            actual: "",
            verdict: "PENDING",
            manualFix: "",
            failureReason: (tc.failureReason ?? "").slice(0, 1000),
          },
        });
      }
    } else if (u.step === 8 && u.key === "testCaseExpected" && typeof u.value === "string") {
      // 把补充的预期写回最近一例"待补充"
      const pending = await prisma.testCase.findFirst({
        where: { projectId, expected: EXPECT_PENDING },
        orderBy: { sortOrder: "desc" },
      });
      if (pending) await prisma.testCase.update({ where: { id: pending.id }, data: { expected: u.value.slice(0, 2000) } });
    }
  }

  // "重说"命中:回复里点明已覆盖原内容
  if (focused && turn.updates.some((u) => u.step === focused.step && u.key === focused.key && u.step !== 8)) {
    turn.reply = turn.reply.replace(/^已记录 ✓/, "已更新,原内容已覆盖 ✓");
  }

  const agentMsg = await prisma.chatMessage.create({
    data: {
      projectId,
      role: "agent",
      content: turn.reply,
      meta: JSON.stringify({ updates: turn.updates, nextTarget: turn.nextTarget, action: turn.action ?? null, grill: turn.grill ?? null }),
    },
  });

  // 刷新进度
  const fresh = await loadProjectBundle(projectId);
  const feedbackCount = await prisma.agentFeedback.count({ where: { projectId } });
  const snapshotCount = await prisma.submissionSnapshot.count({ where: { projectId } });
  const progress = computeProjectProgress(fresh!, {
    feedbackCount,
    hasSnapshot: snapshotCount > 0,
  });

  return {
    ok: true,
    user: toView(userMsg),
    agent: toView(agentMsg),
    progress,
  };
}

export interface ChatMsgView {
  id: string;
  role: string;
  content: string;
  meta: {
    updates?: { step: number; key: string; value: string | boolean | ParsedTestCase }[];
    nextTarget?: { step: number; key: string; label?: string } | null;
    action?: string | null;
    grill?: { q: string; why?: string } | null;
  };
  createdAt: string;
}

function toView(m: { id: string; role: string; content: string; meta: string; createdAt: Date }): ChatMsgView {
  let meta: ChatMsgView["meta"] = {};
  try {
    meta = JSON.parse(m.meta || "{}");
  } catch {
    /* ignore */
  }
  return { id: m.id, role: m.role, content: m.content, meta, createdAt: m.createdAt.toISOString() };
}

export async function chatHistory(projectId: string): Promise<ChatMsgView[]> {
  const rows = await prisma.chatMessage.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, take: 200 });
  return rows.map(toView);
}

export { MockProvider };

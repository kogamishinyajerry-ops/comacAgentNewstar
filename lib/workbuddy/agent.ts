// WorkBuddy 总控 Agent:组织者/管理员的对话式活动控制台。
// 工具 = Activity Control 动作注册表(经权限确认机制执行);LLM 与 Mock 双模式,可注入便于单测。

import { z } from "zod";
import type { ChatJSONParams, ChatJSONResult } from "../llm/provider";
import { tryParseJson } from "../llm/repair";
import { mockPlan, mockReplyAfterTools, type BuddyPlan, type BuddyToolRun } from "./mock-brain";
import type { RunOutcome } from "../control/types";
import type { Role } from "../constants";

export interface BuddyMessage {
  role: "user" | "agent";
  content: string;
}

export interface BuddyToolInfo {
  id: string;
  title: string;
  description: string;
  risk: string;
  inputSchema: Record<string, unknown>;
}

export interface BuddySnapshot {
  activity: { name: string; slogan: string; startDate: string | null; endDate: string | null; submissionDeadline: string | null } | null;
  projectCounts: Record<string, number>;
  teamCount: number;
  pendingConfirmations: number;
}

export interface BuddyDeps {
  chatJSON: (p: ChatJSONParams) => Promise<ChatJSONResult>;
  runTool: (actionId: string, input: unknown) => Promise<RunOutcome>;
  tools: BuddyToolInfo[];
  snapshot: BuddySnapshot;
  userName: string;
  role: Role;
  mockMode: boolean;
  maxToolRounds?: number;
}

const PlanSchema = z.object({
  reply: z.string().default(""),
  toolCalls: z
    .array(
      z.object({
        id: z.string().default(""),
        action: z.string().min(1),
        input: z.record(z.unknown()).default({}),
      })
    )
    .max(3)
    .default([]),
});

export const WORKBUDDY_SYSTEM_PROMPT = `你是 WorkBuddy——青年AI轻创活动的总控 Agent,服务对象是活动组织者与管理员。

## 职责
1. 用中文简洁回答活动运营问题;数据一律来自工具结果,绝不编造数字。
2. 需要操作时直接调用工具:查询类(SAFE)直接调用;敏感类(announcement.publish / activity.updateConfig / notice.send / project.setStatus / review.assign / track.toggle)同样直接调用。系统会自动生成待人工确认的确认单——**确认环节由确认单承担,不要在对话里再口头征求许可或等用户说"确认"**;用户已明确表达的意图(如"催办X""退回X""发公告")一口气执行到生成确认单为止。
3. 一次最多调用 2 个工具;参数从用户原话提取,拿不准就先追问,不要猜 ID。
4. 需要 projectId 的操作(催办/状态变更/评审分配):projectId 只来自 activity.overview 返回的 projects 清单(events.recent 不含项目清单);按标题或队伍名匹配,**唯一匹配→直接调用目标工具**;多个候选或零匹配→列出候选让用户选。
5. 活动红线你也要守:不展示未提交草稿全文、不处理敏感明文数据、Agent 分数只供参考。

## 输出协议(严格 JSON,不要输出其他内容)
{"reply":"给组织者的中文回复(本轮要调用工具时可为空串)","toolCalls":[{"id":"t1","action":"<动作id>","input":{}}]}

工具执行结果会以 {"toolResults":[...]} 回传;收到后:用户意图已达成→只给最终中文回复;还需一步(如先查 projectId 再发起操作)→继续调用工具。`;

export function buildSystemPrompt(deps: BuddyDeps): string {
  const s = deps.snapshot;
  const snap = s
    ? [
        `活动:${s.activity?.name ?? "未配置"} | 口号:${s.activity?.slogan ?? "-"}`,
        `日期:${s.activity?.startDate ?? "?"} ~ ${s.activity?.endDate ?? "?"} | 提交截止:${s.activity?.submissionDeadline ?? "未设置"}`,
        `项目计数:${JSON.stringify(s.projectCounts)} | 队伍:${s.teamCount} | 待确认敏感操作:${s.pendingConfirmations}`,
      ].join("\n")
    : "";
  const tools = JSON.stringify(
    deps.tools.map((t) => ({ action: t.id, risk: t.risk, desc: t.description, input: t.inputSchema })),
    null,
    1
  );
  return `${WORKBUDDY_SYSTEM_PROMPT}\n\n## 当前活动快照\n${snap}\n\n## 可用工具\n${tools}\n\n(当前操作者:${deps.userName},角色:${deps.role})`;
}

function conversationOf(history: BuddyMessage[]): string {
  return history
    .slice(-12)
    .map((m) => `${m.role === "user" ? "组织者" : "WorkBuddy"}:${m.content}`)
    .join("\n");
}

async function llmPlan(deps: BuddyDeps, prompt: string, allowTools: boolean): Promise<BuddyPlan> {
  // WorkBuddy 的系统提示词含全部工具 schema,思维链更长;8000 会被截断(finish_reason=length→空content),
  // 实测 12000 稳定
  const out = await deps.chatJSON({ system: buildSystemPrompt(deps), user: prompt, maxTokens: 12000 });
  const parsed = PlanSchema.safeParse(tryParseJson(out.text, true) ?? {});
  const plan = parsed.success ? parsed.data : { reply: "", toolCalls: [] };
  const reply = plan.reply || "";
  if (!allowTools || !plan.toolCalls.length) {
    return { reply: reply || "我处理一下……(模型未给出可用回复,请重试或换个说法)" };
  }
  // 白名单过滤:只允许目录内的动作;reply 一并带回(模型常在调用工具时附带说明,轮次终止时直接采用)
  const known = new Set(deps.tools.map((t) => t.id));
  return { reply, toolCalls: plan.toolCalls.filter((t) => known.has(t.action)).slice(0, 2) };
}

async function executeToolCalls(deps: BuddyDeps, calls: NonNullable<BuddyPlan["toolCalls"]>): Promise<BuddyToolRun[]> {
  const runs: BuddyToolRun[] = [];
  for (const call of calls) {
    try {
      const outcome = await deps.runTool(call.action, call.input);
      if (outcome.kind === "executed") {
        runs.push({ action: call.action, ok: true, result: outcome.result });
      } else {
        runs.push({
          action: call.action,
          ok: true,
          needsConfirmation: true,
          confirmationId: outcome.confirmationId,
          summary: outcome.summary,
        });
      }
    } catch (e) {
      runs.push({ action: call.action, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return runs;
}

/** 一轮对话:GLM 模式 = 计划→工具→再总结(≤maxToolRounds);Mock 模式 = 规则路由,同样真实执行工具 */
export async function runWorkBuddyTurn(deps: BuddyDeps, history: BuddyMessage[]): Promise<{ reply: string; toolRuns: BuddyToolRun[] }> {
  const last = history[history.length - 1];
  if (!last || last.role !== "user") return { reply: "请说点什么。", toolRuns: [] };
  const rounds = deps.maxToolRounds ?? 2;

  if (deps.mockMode) {
    const plan = mockPlan(last.content);
    if (plan.toolCalls?.length) {
      const runs = await executeToolCalls(deps, plan.toolCalls);
      return { reply: mockReplyAfterTools(runs), toolRuns: runs };
    }
    return { reply: plan.reply ?? "请再说具体一点。", toolRuns: [] };
  }

  let prompt = `${conversationOf(history)}\n\n(请按输出协议回复 JSON)`;
  let carriedRuns: BuddyToolRun[] = [];
  let lastReply = "";
  for (let round = 0; round < rounds; round++) {
    const plan = await llmPlan(deps, prompt, true);
    lastReply = plan.reply || lastReply;
    if (!plan.toolCalls?.length) break; // 意图已达成,模型只给最终回复
    carriedRuns = carriedRuns.concat(await executeToolCalls(deps, plan.toolCalls));
    // 计划自带结论性回复 → 用它,不再追加一轮(两步意图保持 2 次 LLM 调用)
    if (plan.reply) break;
    if (round === rounds - 1) break;
    prompt = `${conversationOf(history)}\n\n工具执行结果:\n${JSON.stringify(carriedRuns, null, 1)}\n\n(工具已执行。用户意图已达成→只给最终中文回复,toolCalls 置空;还需一步操作(如已查到 projectId,现在发起催办/状态变更)→继续调用相应工具,reply 可带一句说明)`;
  }
  return { reply: lastReply || mockReplyAfterTools(carriedRuns) || "处理完毕。", toolRuns: carriedRuns };
}

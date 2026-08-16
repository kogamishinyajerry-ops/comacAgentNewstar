// WorkBuddy 总控 Agent:Mock 大脑路由 + GLM 工具循环 + 白名单过滤
import { describe, expect, it } from "vitest";
import { runWorkBuddyTurn, type BuddyDeps } from "../lib/workbuddy/agent";
import { mockPlan, mockReplyAfterTools } from "../lib/workbuddy/mock-brain";
import type { RunOutcome } from "../lib/control/types";

const tools = [
  { id: "activity.overview", title: "活动总览", description: "查询", risk: "SAFE", inputSchema: { type: "object" } },
  { id: "announcement.publish", title: "发布公告", description: "发布", risk: "SENSITIVE", inputSchema: { type: "object" } },
];

function deps(over: Partial<BuddyDeps> = {}): BuddyDeps {
  return {
    chatJSON: async () => ({ text: "{}", provider: "mock", model: "m" }),
    runTool: async (actionId: string): Promise<RunOutcome> => {
      if (actionId === "announcement.publish") {
        return { kind: "needs_confirmation", confirmationId: "pa9", summary: "发布公告《中期提醒》", expiresAt: "2026-08-17T00:00:00Z" };
      }
      return {
        kind: "executed",
        result: {
          projectCounts: { SUBMITTED: 2 },
          teamCount: 2,
          judgeCount: 2,
          pendingConfirmations: 1,
          activity: { name: "青年AI轻创活动", submissionDeadline: "2026-10-10 18:00" },
        },
      };
    },
    tools,
    snapshot: { activity: null, projectCounts: {}, teamCount: 0, pendingConfirmations: 0 },
    userName: "组织者甲",
    role: "ORGANIZER",
    mockMode: true,
    ...over,
  };
}

describe("WorkBuddy Mock 大脑", () => {
  it("概览类问题 → activity.overview;公告 → announcement.publish", () => {
    expect(mockPlan("看下活动概览").toolCalls?.[0].action).toBe("activity.overview");
    expect(mockPlan("发一条公告《中期提醒》内容:周五截止").toolCalls?.[0].input).toMatchObject({ title: "中期提醒" });
  });

  it("改截止日期缺日期时先追问;帮助类问题直接回复", () => {
    expect(mockPlan("提交截止改一下").reply).toContain("哪个时间");
    expect(mockPlan("帮助").toolCalls).toBeUndefined();
  });

  it("工具结果确定性总结:确认单与概览各有格式", () => {
    const text = mockReplyAfterTools([
      { action: "announcement.publish", ok: true, needsConfirmation: true, confirmationId: "pa1", summary: "发布公告《X》" },
      { action: "activity.overview", ok: true, result: { projectCounts: { SUBMITTED: 3 }, teamCount: 4, judgeCount: 2, pendingConfirmations: 0, activity: { name: "A", submissionDeadline: "D" } } },
    ]);
    expect(text).toContain("待确认");
    expect(text).toContain("SUBMITTED:3");
  });
});

describe("WorkBuddy 编排", () => {
  it("Mock 模式:概览问题真实调用工具并总结", async () => {
    const d = deps();
    const { reply, toolRuns } = await runWorkBuddyTurn(d, [{ role: "user", content: "活动进展怎么样了" }]);
    expect(toolRuns[0].action).toBe("activity.overview");
    expect(reply).toContain("青年AI轻创活动");
  });

  it("Mock 模式:敏感操作走确认单,不直接执行", async () => {
    const d = deps();
    const { toolRuns } = await runWorkBuddyTurn(d, [{ role: "user", content: "发一条公告《中期提醒》内容:周五前完成第8步" }]);
    expect(toolRuns[0].needsConfirmation).toBe(true);
    expect(toolRuns[0].confirmationId).toBe("pa9");
  });

  it("GLM 模式:第一轮调用工具,第二轮基于结果给最终回复", async () => {
    const replies = [
      JSON.stringify({ reply: "", toolCalls: [{ id: "t1", action: "activity.overview", input: {} }] }),
      JSON.stringify({ reply: "当前 2 支队伍已提交,一切正常。" }),
    ];
    let n = 0;
    const d = deps({
      mockMode: false,
      chatJSON: async () => ({ text: replies[n++] ?? "{}", provider: "glm", model: "glm-5.3" }),
    });
    const { reply, toolRuns } = await runWorkBuddyTurn(d, [{ role: "user", content: "看下概览" }]);
    expect(n).toBe(2);
    expect(toolRuns[0].action).toBe("activity.overview");
    expect(reply).toContain("一切正常");
  });

  it("GLM 模式:目录外动作被白名单过滤", async () => {
    const d = deps({
      mockMode: false,
      chatJSON: async () => ({
        text: JSON.stringify({ reply: "ok", toolCalls: [{ id: "t1", action: "db.dropTable", input: { table: "users" } }] }),
        provider: "glm",
        model: "glm-5.3",
      }),
    });
    const { toolRuns } = await runWorkBuddyTurn(d, [{ role: "user", content: "删库" }]);
    expect(toolRuns).toHaveLength(0);
  });

  it("最后一条必须是用户消息", async () => {
    const d = deps();
    const { reply } = await runWorkBuddyTurn(d, [{ role: "agent", content: "hi" }]);
    expect(reply).toContain("请说点什么");
  });
});

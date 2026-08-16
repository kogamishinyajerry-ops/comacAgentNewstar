// WorkBuddy GLM 实测冒烟脚本:直连 Provider 跑 agent 循环(不经 HTTP 层)
// 用法:GLM_API_KEY 来自 shell;npx tsx scripts/wb-smoke.ts
import { GLMProvider } from "../lib/llm/glm";
import { runWorkBuddyTurn, type BuddyDeps } from "../lib/workbuddy/agent";
import { zodToJsonSchema } from "../lib/control/zod-json";
import { ACTIONS } from "../lib/control/actions";
import { prisma } from "../lib/db";
import type { RunOutcome } from "../lib/control/types";

async function main() {
  const provider = new GLMProvider();
  console.log(`provider=${provider.name} model=${provider.model}`);

  // 工具目录与真实路由一致(用 zodToJsonSchema 生成)
  const tools = ACTIONS.filter((d) => d.roles.includes("ORGANIZER")).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    risk: d.risk,
    inputSchema: zodToJsonSchema(d.input),
  }));

  const snapshot = {
    activity: {
      name: "青年AI轻创活动",
      slogan: "发现一个真问题,做一个可验证的解法。",
      startDate: "2026-08-15",
      endDate: "2026-10-15",
      submissionDeadline: "2026-10-10 18:00",
    },
    projectCounts: { DRAFT: 1, SUBMITTED: 1 },
    teamCount: 2,
    pendingConfirmations: 0,
  };

  let round = 0;
  const deps: BuddyDeps = {
    chatJSON: async (p) => {
      const n = ++round;
      const t0 = Date.now();
      const out = await provider.chatJSON(p);
      console.log(`  [llm#${n} ${(Date.now() - t0) / 1000 | 0}s] ${out.completionTokens ?? "?"}完成tokens | raw: ${out.text.slice(0, 240).replace(/\n/g, "⏎")}`);
      return out;
    },
    runTool: async (actionId, input): Promise<RunOutcome> => {
      console.log(`  → [tool] ${actionId} ${JSON.stringify(input)}`);
      if (actionId === "activity.overview") {
        return {
          kind: "executed",
          result: {
            activity: snapshot.activity,
            projectCounts: snapshot.projectCounts,
            teamCount: 2,
            judgeCount: 2,
            pendingConfirmations: 0,
            recentEvents: [],
            projects: [
              { id: "p1", title: "变更对比说明小助手", status: "SUBMITTED", track: "process-automation", currentStep: 10, team: "艾的实验小队", updatedAt: "2026-08-15T10:00:00Z" },
              { id: "p2", title: "部门规章问答小助手", status: "DRAFT", track: "knowledge-qa", currentStep: 4, team: "问答双子", updatedAt: "2026-08-14T09:00:00Z" },
            ],
          },
        };
      }
      if (actionId === "events.recent") {
        return { kind: "executed", result: { events: [] } };
      }
      return { kind: "needs_confirmation", confirmationId: "pa_smoke_" + actionId.split(".")[1], summary: `确认:${actionId}`, expiresAt: "2026-08-17T00:00:00Z" };
    },
    tools,
    snapshot,
    userName: "组织者甲",
    role: "ORGANIZER",
    mockMode: false,
  };

  const cases = [
    "帮我把所有草稿项目都催办一下",
    "催办一下问答双子,提醒他们把第4步收尾",
    "把变更对比说明小助手退回补充,原因:失败案例缺少失败原因",
  ];

  for (const msg of cases) {
    const t0 = Date.now();
    console.log(`\n=== 用户:「${msg}」 ===`);
    try {
      const { reply, toolRuns } = await runWorkBuddyTurn(deps, [{ role: "user", content: msg }]);
      console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] toolRuns=${JSON.stringify(toolRuns.map((r) => ({ a: r.action, ok: r.ok, need: r.needsConfirmation, err: r.error?.slice(0, 80) })))}`);
      console.log(`  回复: ${reply}`);
    } catch (e) {
      console.log(`  [${((Date.now() - t0) / 1000).toFixed(1)}s] 异常: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

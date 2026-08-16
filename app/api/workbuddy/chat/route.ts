// WorkBuddy 总控 Agent 对话端点:仅组织者/管理员;无状态(客户端持有历史,服务端截断到最近12轮)
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { GLMProvider } from "@/lib/llm/glm";
import { MockProvider } from "@/lib/llm/mock";
import { checkRateLimit, isMockEnabled } from "@/lib/llm/provider";
import { activityActionsForRole, runActivityAction } from "@/lib/control";
import { zodToJsonSchema } from "@/lib/control/zod-json";
import { runWorkBuddyTurn, type BuddyMessage } from "@/lib/workbuddy/agent";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "agent"]), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40),
});

export const maxDuration = 120;

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "WorkBuddy 仅对组织者与管理员开放");
  if (!checkRateLimit(`workbuddy:${user.id}`, 10, 60_000)) return jsonError(429, "请求太频繁,请稍后再试");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const history = parsed.data.messages as BuddyMessage[];
  if (history[history.length - 1].role !== "user") return jsonError(400, "最后一条必须是用户消息");

  const mockMode = isMockEnabled();

  // 活动快照(给系统提示词)
  const [config, byStatus, teamCount, pendingCount] = await Promise.all([
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
    prisma.ideaProject.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.team.count(),
    prisma.pendingAction.count({ where: { status: "PENDING" } }),
  ]);
  const projectCounts: Record<string, number> = {};
  for (const row of byStatus) projectCounts[row.status] = row._count._all;

  const provider = mockMode ? new MockProvider() : new GLMProvider();
  const tools = activityActionsForRole(user.role).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    risk: d.risk,
    inputSchema: zodToJsonSchema(d.input),
  }));

  const { reply, toolRuns } = await runWorkBuddyTurn(
    {
      chatJSON: (p) => provider.chatJSON(p),
      runTool: (actionId, input) =>
        runActivityAction(actionId, input, { actorId: "agent:workbuddy", actorName: `WorkBuddy(经${user.name})`, role: user.role, source: "workbuddy" }),
      tools,
      snapshot: {
        activity: config
          ? {
              name: config.name,
              slogan: config.slogan,
              startDate: config.startDate,
              endDate: config.endDate,
              submissionDeadline: config.submissionDeadline,
            }
          : null,
        projectCounts,
        teamCount,
        pendingConfirmations: pendingCount,
      },
      userName: user.name,
      role: user.role,
      mockMode,
    },
    history
  );

  await audit(user, "workbuddy.chat", "ActivityControl", "workbuddy", `tools:${toolRuns.map((t) => t.action).join(",") || "none"}`);
  return Response.json({
    ok: true,
    reply,
    toolRuns: toolRuns.map((t) => ({ ...t, result: undefined })),
    pendingCount: pendingCount + toolRuns.filter((t) => t.needsConfirmation).length,
    mockMode,
  });
}

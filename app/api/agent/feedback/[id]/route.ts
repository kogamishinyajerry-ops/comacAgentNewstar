import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const Body = z.object({
  index: z.number().int().min(0).max(2),
  state: z.enum(["adopted", "ignored", "done", "none"]),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const feedbackId = params.id;
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "参数错误");

  const feedback = await prisma.agentFeedback.findUnique({
    where: { id: feedbackId },
    include: { project: { include: { team: { include: { members: true } } } } },
  });
  if (!feedback) return jsonError(404, "反馈不存在");
  const isMember = feedback.project.team.members.some((m) => m.userId === user.id);
  if (!isMember && user.role !== "ADMIN") return jsonError(403, "只有本队成员可以处理建议");

  let states: Record<string, string> = {};
  try {
    states = JSON.parse(feedback.suggestionStates) as Record<string, string>;
  } catch {
    states = {};
  }
  const key = String(parsed.data.index);
  if (parsed.data.state === "none") delete states[key];
  else states[key] = parsed.data.state;

  await prisma.agentFeedback.update({
    where: { id: feedbackId },
    data: { suggestionStates: JSON.stringify(states) },
  });
  await audit(user, "agent.suggestion_state", "AgentFeedback", feedbackId, `${key}=${parsed.data.state}`);
  return Response.json({ ok: true, states });
}

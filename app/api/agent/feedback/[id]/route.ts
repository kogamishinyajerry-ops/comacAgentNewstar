import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const Body = z.object({
  index: z.number().int().min(0).max(2),
  state: z.enum(["adopted", "ignored", "done", "none"]),
});

const AnswerBody = z.object({
  qindex: z.number().int().min(0).max(5),
  answer: z.string().trim().min(1, "回答不能为空").max(600),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const feedbackId = params.id;
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");

  const raw = await readJson<Record<string, unknown>>(req);
  if (!raw) return jsonError(400, "参数错误");
  const feedback = await prisma.agentFeedback.findUnique({
    where: { id: feedbackId },
    include: { project: { include: { team: { include: { members: true } } } } },
  });
  if (!feedback) return jsonError(404, "反馈不存在");
  const isMember = feedback.project.team.members.some((m) => m.userId === user.id);
  if (!isMember && user.role !== "ADMIN") return jsonError(403, "只有本队成员可以处理反馈");

  // 追问作答:存入 answers,下一轮Agent会带着你的回答继续深挖
  if ("qindex" in raw) {
    const parsed = AnswerBody.safeParse(raw);
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
    let answers: Record<string, string> = {};
    try {
      answers = JSON.parse(feedback.answers || "{}") as Record<string, string>;
    } catch {
      answers = {};
    }
    answers[String(parsed.data.qindex)] = parsed.data.answer;
    await prisma.agentFeedback.update({
      where: { id: feedbackId },
      data: { answers: JSON.stringify(answers) },
    });
    await audit(user, "agent.answer", "AgentFeedback", feedbackId, `q${parsed.data.qindex}`);
    return Response.json({ ok: true, answers });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return jsonError(400, "参数错误");

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

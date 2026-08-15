import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { loadProjectBundle } from "@/lib/projects";
import { computeProjectProgress } from "@/lib/progress";

const Body = z.object({
  projectId: z.string().min(1),
  message: z.string().trim().max(300).optional(),
});

/** 组织者温和催办:向项目全体成员发站内通知(默认话术无压力、附最小下一步) */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可发送提醒");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const bundle = await loadProjectBundle(parsed.data.projectId);
  if (!bundle) return jsonError(404, "项目不存在");
  if (["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"].includes(bundle.project.status)) {
    return jsonError(409, "该作品已提交/归档,无需催办");
  }

  const progress = computeProjectProgress(bundle, {
    feedbackCount: await prisma.agentFeedback.count({ where: { projectId: bundle.project.id } }),
    hasSnapshot: (await prisma.submissionSnapshot.count({ where: { projectId: bundle.project.id } })) > 0,
  });

  const message =
    parsed.data.message?.trim() ||
    `「${bundle.project.title}」当前的最新进展已同步给组织者。此刻最小下一步:${progress.nextHint}。按自己的节奏推进即可,遇到卡点欢迎来 Office Hour 或在项目页找专职Agent聊一聊。`;

  const link = `/projects/${bundle.project.id}?step=${progress.currentStep}`;
  await prisma.notice.createMany({
    data: bundle.members.map((m) => ({
      userId: m.userId,
      title: `组织者提醒:${bundle.project.title}`,
      body: message,
      link,
    })),
  });
  await audit(user, "notice.nudge", "IdeaProject", bundle.project.id, `to ${bundle.members.length}人`);
  return Response.json({ ok: true, sent: bundle.members.length });
}

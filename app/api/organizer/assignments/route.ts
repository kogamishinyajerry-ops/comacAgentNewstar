import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const Body = z.object({
  projectId: z.string().min(1),
  judgeId: z.string().min(1),
  round: z.enum(["PRELIMINARY", "FINAL"]),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const { projectId, judgeId, round } = parsed.data;
  const [project, judge] = await Promise.all([
    prisma.ideaProject.findUnique({ where: { id: projectId } }),
    prisma.user.findUnique({ where: { id: judgeId } }),
  ]);
  if (!project) return jsonError(404, "项目不存在");
  if (!judge || judge.role !== "JUDGE") return jsonError(400, "该用户不是评委");
  if (project.status === "DRAFT") return jsonError(400, "草稿状态不能分配评审");

  const existing = await prisma.reviewAssignment.findFirst({
    where: { projectId, judgeId, round },
  });
  if (existing) return jsonError(409, "该评委在此轮已被分配过此作品");

  const assignment = await prisma.reviewAssignment.create({ data: { projectId, judgeId, round } });
  await audit(user, "review.assign", "ReviewAssignment", assignment.id, `${judge.name} → ${project.title} (${round})`);
  return Response.json({ ok: true, assignmentId: assignment.id });
}

export async function DELETE(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError(400, "缺少id");
  const assignment = await prisma.reviewAssignment.findUnique({ where: { id }, include: { review: true } });
  if (!assignment) return jsonError(404, "分配不存在");
  if (assignment.review?.status === "LOCKED") return jsonError(409, "该评分已锁定,不能取消分配");
  await prisma.reviewAssignment.delete({ where: { id } });
  await audit(user, "review.unassign", "ReviewAssignment", id);
  return Response.json({ ok: true });
}

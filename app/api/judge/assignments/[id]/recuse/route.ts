import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";

/** 评委回避 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "JUDGE" && user.role !== "ADMIN") return jsonError(403, "仅评委可回避");

  const assignment = await prisma.reviewAssignment.findUnique({ where: { id: params.id }, include: { review: true } });
  if (!assignment) return jsonError(404, "分配不存在");
  if (assignment.judgeId !== user.id) return jsonError(403, "只能回避分配给自己的评审");
  if (assignment.review?.status === "LOCKED") return jsonError(409, "已锁定的评分不能回避");

  await prisma.reviewAssignment.update({ where: { id: params.id }, data: { status: "RECUSED" } });
  await audit(user, "review.recuse", "ReviewAssignment", params.id);
  return Response.json({ ok: true });
}

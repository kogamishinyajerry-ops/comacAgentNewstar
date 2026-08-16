import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { emitEvent } from "@/lib/events/bus";

const Body = z.object({
  problemDefinition: z.number().int().min(0).max(10),
  originality: z.number().int().min(0).max(10),
  closedLoop: z.number().int().min(0).max(10),
  evidence: z.number().int().min(0).max(10),
  bestValue: z.string().trim().max(500).default(""),
  topImprovement: z.string().trim().max(500).default(""),
});

async function loadAssignment(assignmentId: string, userId: string) {
  const assignment = await prisma.reviewAssignment.findUnique({
    where: { id: assignmentId },
    include: { review: true },
  });
  if (!assignment) return { error: jsonError(404, "分配不存在") };
  if (assignment.judgeId !== userId) return { error: jsonError(403, "只能操作分配给自己的评审") };
  return { assignment };
}

/** 保存草稿 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "JUDGE" && user.role !== "ADMIN") return jsonError(403, "仅评委可评分");
  const { assignment, error } = await loadAssignment(params.id, user.id);
  if (error) return error;
  if (assignment.review?.status === "LOCKED") return jsonError(409, "评分已锁定,不能再修改");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { bestValue, topImprovement, ...scores } = parsed.data;

  if (assignment.review) {
    await prisma.review.update({
      where: { id: assignment.review.id },
      data: { ...scores, bestValue, topImprovement },
    });
  } else {
    await prisma.review.create({
      data: { assignmentId: assignment.id, ...scores, bestValue, topImprovement },
    });
  }
  return Response.json({ ok: true });
}

/** 提交并锁定 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "JUDGE" && user.role !== "ADMIN") return jsonError(403, "仅评委可评分");
  const { assignment, error } = await loadAssignment(params.id, user.id);
  if (error) return error;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { bestValue, topImprovement, ...scores } = parsed.data;
  if (!bestValue.trim() || !topImprovement.trim()) {
    return jsonError(400, "提交前请填写\"最大价值\"与\"首要改进\"");
  }

  const review =
    assignment.review ??
    (await prisma.review.create({ data: { assignmentId: assignment.id, ...scores, bestValue, topImprovement } }));

  try {
    await prisma.$transaction(async (tx) => {
      if (assignment.review) {
        await tx.review.update({ where: { id: review.id }, data: { ...scores, bestValue, topImprovement } });
      }
      await tx.review.update({ where: { id: review.id }, data: { status: "LOCKED", lockedAt: new Date() } });
      await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: "COMPLETED" } });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("REVIEW_LOCKED")) return jsonError(409, "评分已锁定,不能重复提交");
    throw e;
  }
  await audit(user, "review.lock", "Review", review.id, `assignment=${assignment.id}`);
  await emitEvent({ type: "review.locked", payload: { reviewId: review.id, assignmentId: assignment.id, projectId: assignment.projectId }, actor: user, projectId: assignment.projectId });
  return Response.json({ ok: true });
}

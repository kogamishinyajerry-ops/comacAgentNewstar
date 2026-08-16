import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { emitEvent } from "@/lib/events/bus";

const Body = z.object({
  action: z.enum(["return", "preliminary", "final", "archive"]),
  reason: z.string().trim().max(500).optional(),
});

const transitions: Record<string, { from: string[]; to: string }> = {
  return: { from: ["SUBMITTED", "PRELIMINARY"], to: "RETURNED" },
  preliminary: { from: ["SUBMITTED"], to: "PRELIMINARY" },
  final: { from: ["PRELIMINARY"], to: "FINAL" },
  archive: { from: ["FINAL", "PRELIMINARY", "RETURNED", "SUBMITTED"], to: "ARCHIVED" },
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { action, reason } = parsed.data;

  const project = await prisma.ideaProject.findUnique({ where: { id: params.id } });
  if (!project) return jsonError(404, "项目不存在");

  const t = transitions[action];
  if (!t.from.includes(project.status)) {
    return jsonError(409, `当前状态(${project.status})不允许该操作`);
  }
  if (action === "return" && !reason?.trim()) {
    return jsonError(400, "退回补充必须填写原因");
  }

  await prisma.ideaProject.update({
    where: { id: params.id },
    data: { status: t.to, returnReason: action === "return" ? reason : null },
  });
  await audit(user, `project.${action}`, "IdeaProject", params.id, reason ?? "");
  await emitEvent({
    type: "project.status_changed",
    payload: { projectId: params.id, title: project.title, from: project.status, to: t.to, reason: reason ?? null },
    actor: user,
    projectId: params.id,
  });
  return Response.json({ ok: true, status: t.to });
}

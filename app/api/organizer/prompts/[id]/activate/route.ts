import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";

/** 激活指定 Prompt 版本(同 purpose 仅一个 active) */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");

  const version = await prisma.promptVersion.findUnique({ where: { id: params.id } });
  if (!version) return jsonError(404, "Prompt版本不存在");

  await prisma.$transaction([
    prisma.promptVersion.updateMany({ where: { purpose: version.purpose }, data: { active: false } }),
    prisma.promptVersion.update({ where: { id: params.id }, data: { active: true } }),
  ]);
  await audit(user, "prompt.activate", "PromptVersion", params.id, version.version);
  return Response.json({ ok: true });
}

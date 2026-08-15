import { prisma } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/auth";

/** 标记已读 */
export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const row = await prisma.notice.findUnique({ where: { id: params.id } });
  if (!row || row.userId !== user.id) return jsonError(404, "通知不存在");
  if (!row.readAt) {
    await prisma.notice.update({ where: { id: params.id }, data: { readAt: new Date() } });
  }
  return Response.json({ ok: true });
}

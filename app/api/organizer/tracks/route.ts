import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const TrackBody = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(30),
  description: z.string().trim().min(1).max(200),
  suitable: z.string().trim().min(1).max(200),
  unsuitable: z.string().trim().min(1).max(200),
  example: z.string().trim().min(1).max(300),
});

export async function PUT(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");
  const parsed = TrackBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { id, ...rest } = parsed.data;
  // 只允许修改既有四赛道文案,不可新增或删除
  const track = await prisma.trackConfig.findUnique({ where: { id } });
  if (!track) return jsonError(404, "赛道不存在;赛道固定为四个,不可新增");
  await prisma.trackConfig.update({ where: { id }, data: rest });
  await audit(user, "config.track.update", "TrackConfig", id, rest.name);
  return Response.json({ ok: true });
}

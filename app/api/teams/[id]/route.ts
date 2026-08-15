import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  mode: z.enum(["SOLO", "ECHO", "DELTA", "DUO"]).optional(),
  startTime: z.string().trim().max(200).optional(),
  existingBase: z.string().trim().max(1000).optional(),
  addedDuringActivity: z.string().trim().max(1000).optional(),
  externalResources: z.string().trim().max(1000).optional(),
  helpers: z.string().trim().max(1000).optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const membership = await prisma.teamMember.findFirst({ where: { teamId: params.id, userId: user.id } });
  if (!membership) return jsonError(403, "只有本队成员可以修改队伍信息");
  const memberCount = await prisma.teamMember.count({ where: { teamId: params.id } });
  const data = { ...parsed.data };
  if (data.mode === "SOLO" && memberCount > 1) return jsonError(400, "队伍已有2人,不能切换为单人模式");

  const team = await prisma.team.update({ where: { id: params.id }, data });
  await audit(user, "team.update", "Team", team.id, Object.keys(data).join(","));
  return Response.json({ ok: true, team: { id: team.id, mode: team.mode } });
}

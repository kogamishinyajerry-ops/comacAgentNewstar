import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  inviteCode: z.string().trim().min(4, "请输入邀请码").max(16),
  seatRole: z.enum(["ECHO", "DELTA"]).default("DELTA"),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "PARTICIPANT" && user.role !== "ADMIN") return jsonError(403, "仅参与者可以加入队伍");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const { inviteCode, seatRole } = parsed.data;
  const team = await prisma.team.findUnique({ where: { inviteCode: inviteCode.toUpperCase() }, include: { members: true } });
  if (!team) return jsonError(404, "邀请码无效,请与队长确认");
  if (team.members.some((m) => m.userId === user.id)) return jsonError(409, "你已在该队伍中");
  if (team.members.length >= 2) return jsonError(409, "该队伍已满2人,无法加入");
  const existing = await prisma.teamMember.findFirst({ where: { userId: user.id } });
  if (existing) return jsonError(409, "你已加入其他队伍,每名参与者只能属于一个队伍");

  try {
    await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, seatRole } });
  } catch (e) {
    // 数据库触发器兜底
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("TEAM_FULL")) return jsonError(409, "该队伍已满2人,无法加入");
    throw e;
  }
  if (team.members.length === 1) {
    await prisma.team.update({ where: { id: team.id }, data: { mode: "DUO" } }).catch(() => undefined);
  }
  await audit(user, "team.join", "Team", team.id, `seatRole=${seatRole}`);
  return Response.json({ ok: true, teamId: team.id });
}

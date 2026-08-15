import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, genInviteCode, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  name: z.string().trim().min(2, "队伍名至少2个字符").max(30),
  mode: z.enum(["SOLO", "ECHO", "DELTA", "DUO"]).default("SOLO"),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "PARTICIPANT" && user.role !== "ADMIN") return jsonError(403, "仅参与者可以创建队伍");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const existing = await prisma.teamMember.findFirst({ where: { userId: user.id } });
  if (existing) return jsonError(409, "你已加入一支队伍,每名参与者只能属于一个队伍");

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      mode: parsed.data.mode,
      inviteCode: genInviteCode(),
    },
  });
  await prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, seatRole: "OWNER" } });
  await audit(user, "team.create", "Team", team.id, team.name);
  return Response.json({ ok: true, teamId: team.id, inviteCode: team.inviteCode });
}

export async function GET() {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const membership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    include: { team: { include: { members: { include: { user: true } } } } },
  });
  if (!membership) return Response.json({ team: null });
  const { team } = membership;
  return Response.json({
    team: {
      id: team.id,
      name: team.name,
      mode: team.mode,
      inviteCode: team.inviteCode,
      startTime: team.startTime,
      existingBase: team.existingBase,
      addedDuringActivity: team.addedDuringActivity,
      externalResources: team.externalResources,
      helpers: team.helpers,
      members: team.members.map((m) => ({ userId: m.userId, name: m.user.name, seatRole: m.seatRole })),
    },
  });
}

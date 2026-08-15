import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  title: z.string().trim().min(2, "想法名称至少2个字符").max(60),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const membership = await prisma.teamMember.findFirst({ where: { userId: user.id } });
  if (!membership) return jsonError(400, "请先在第2步创建或加入队伍,再新建想法");

  const project = await prisma.ideaProject.create({
    data: { teamId: membership.teamId, title: parsed.data.title },
  });
  await audit(user, "project.create", "IdeaProject", project.id, project.title);
  return Response.json({ ok: true, projectId: project.id });
}

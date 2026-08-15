import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const Body = z.object({
  officeHourId: z.string().min(1),
  action: z.enum(["join", "cancel"]),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "参数错误");

  const oh = await prisma.officeHour.findUnique({ where: { id: parsed.data.officeHourId } });
  if (!oh) return jsonError(404, "场次不存在");

  let signups: string[] = JSON.parse(oh.signups || "[]");
  if (parsed.data.action === "join") {
    if (signups.length >= oh.capacity) return jsonError(409, "该场次已满");
    if (!signups.includes(user.id)) signups.push(user.id);
  } else {
    signups = signups.filter((id) => id !== user.id);
  }
  await prisma.officeHour.update({ where: { id: oh.id }, data: { signups: JSON.stringify(signups) } });
  return Response.json({ ok: true, count: signups.length });
}

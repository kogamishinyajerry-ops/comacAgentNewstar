import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  email: z.string().trim().email("邮箱格式不正确"),
  password: z.string().min(1, "请输入密码"),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError(401, "邮箱或密码不正确");
  }
  await createSession(user.id);
  await audit({ id: user.id, name: user.name }, "user.login", "User", user.id);
  return Response.json({ ok: true, role: user.role });
}

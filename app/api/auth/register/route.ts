import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword, jsonError, audit } from "@/lib/auth";

const Body = z.object({
  name: z.string().trim().min(2, "姓名至少2个字符").max(30),
  email: z.string().trim().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少8位").max(64),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { name, email, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return jsonError(409, "该邮箱已注册,请直接登录");
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password), role: "PARTICIPANT" },
  });
  await createSession(user.id);
  await audit({ id: user.id, name }, "user.register", "User", user.id, email);
  return Response.json({ ok: true, role: user.role });
}

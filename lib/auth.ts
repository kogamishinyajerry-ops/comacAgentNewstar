// 自研会话认证:DB Session + httpOnly Cookie + RBAC + 审计日志

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role } from "./constants";

export const SESSION_COOKIE = "ynav_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function genInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function createSession(userId: string): Promise<void> {
  const token = randomUUID() + randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const store = cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { token } }).catch(() => undefined);
    return null;
  }
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
  };
});

/** 服务端组件守卫:未登录跳转登录页 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/** API 守卫:返回 null 表示未通过,由调用方决定 401/403 */
export async function apiUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

export function jsonError(status: number, message: string, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}

export async function audit(
  actor: { id?: string; name: string } | null,
  action: string,
  targetType: string,
  targetId: string,
  detail = ""
): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? "system",
      action,
      targetType,
      targetId,
      detail,
    },
  });
}

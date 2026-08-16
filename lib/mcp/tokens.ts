// MCP 接入令牌:明文仅创建时返回一次,库里只存 sha256 哈希与前8位前缀。

import { createHash, randomBytes } from "crypto";
import { prisma } from "../db";
import { emitEvent } from "../events/bus";

export function hashToken(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function generateToken(): { plain: string; prefix: string } {
  const plain = `wb_${randomBytes(24).toString("base64url")}`;
  return { plain, prefix: plain.slice(0, 11) };
}

export interface TokenView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function createApiToken(userId: string, userName: string, name: string): Promise<{ token: TokenView; plain: string }> {
  const { plain, prefix } = generateToken();
  const row = await prisma.apiToken.create({ data: { name, tokenHash: hashToken(plain), prefix, userId } });
  await emitEvent({ type: "agent.token_created", payload: { tokenId: row.id, name, prefix }, actor: { id: userId, name: userName } });
  return {
    plain,
    token: { id: row.id, name: row.name, prefix: row.prefix, lastUsedAt: null, revokedAt: null, createdAt: row.createdAt.toISOString() },
  };
}

export async function listApiTokens(userId: string): Promise<TokenView[]> {
  const rows = await prisma.apiToken.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    revokedAt: r.revokedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function revokeApiToken(userId: string, userName: string, tokenId: string): Promise<boolean> {
  const row = await prisma.apiToken.findUnique({ where: { id: tokenId } });
  if (!row || row.userId !== userId) return false;
  if (row.revokedAt) return true;
  await prisma.apiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
  await emitEvent({ type: "agent.token_revoked", payload: { tokenId, name: row.name, prefix: row.prefix }, actor: { id: userId, name: userName } });
  return true;
}

/** 校验 Bearer 令牌,命中则返回属主(并记录最近使用);返回 null 表示无效 */
export async function authenticateApiToken(bearer: string | null): Promise<{ userId: string; name: string; role: string; prefix: string } | null> {
  if (!bearer?.startsWith("wb_")) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(bearer) } });
  if (!row || row.revokedAt) return null;
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  if (!user) return null;
  await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return { userId: user.id, name: `${row.name}(${user.name}的令牌)`, role: user.role, prefix: row.prefix };
}

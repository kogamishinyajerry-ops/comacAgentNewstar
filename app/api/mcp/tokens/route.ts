// MCP 令牌管理:列出/创建自己的接入令牌(组织者与管理员)
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { createApiToken, listApiTokens } from "@/lib/mcp/tokens";

const CreateBody = z.object({ name: z.string().trim().min(1).max(40) });

export async function GET() {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可管理 MCP 令牌");
  return Response.json({ ok: true, tokens: await listApiTokens(user.id) });
}

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可管理 MCP 令牌");
  const parsed = CreateBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const { token, plain } = await createApiToken(user.id, user.name, parsed.data.name);
  // 明文只出现这一次
  return Response.json({ ok: true, token, plain });
}

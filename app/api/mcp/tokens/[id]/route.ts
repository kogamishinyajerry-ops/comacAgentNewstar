// MCP 令牌管理:吊销自己的令牌
import { apiUser, jsonError } from "@/lib/auth";
import { revokeApiToken } from "@/lib/mcp/tokens";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可管理 MCP 令牌");
  const ok = await revokeApiToken(user.id, user.name, params.id);
  if (!ok) return jsonError(404, "令牌不存在");
  return Response.json({ ok: true });
}

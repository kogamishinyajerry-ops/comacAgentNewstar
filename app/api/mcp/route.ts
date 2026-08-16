// MCP Server 端点:POST /api/mcp(JSON-RPC 2.0,Streamable HTTP 传输,无状态)。
// 认证:Authorization: Bearer <wb_...>(在 /integrations 创建)或组织者/管理员登录态。
// 工具目录 = Activity Control 动作注册表;SENSITIVE 工具返回 needsConfirmation,由人在 Web 端批准。

import { apiUser } from "@/lib/auth";
import { activityActionsForRole, runActivityAction } from "@/lib/control";
import { zodToJsonSchema } from "@/lib/control/zod-json";
import { authenticateApiToken } from "@/lib/mcp/tokens";
import { handleMcpRequest, type McpAuthz, type McpBackend } from "@/lib/mcp/protocol";
import type { Role } from "@/lib/constants";
import { ControlError } from "@/lib/control/types";

export const dynamic = "force-dynamic";

const backend: McpBackend = {
  async auth(req: Request): Promise<McpAuthz | null> {
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? null;
    if (bearer) {
      const hit = await authenticateApiToken(bearer);
      if (!hit) return null;
      return { name: hit.name, role: hit.role as Role, actorId: `mcp:${hit.prefix}` };
    }
    // 无令牌时接受组织者/管理员会话(浏览器内调试用)
    const user = await apiUser();
    if (user && (user.role === "ORGANIZER" || user.role === "ADMIN")) {
      return { name: user.name, role: user.role, actorId: user.id };
    }
    return null;
  },

  listTools(auth: McpAuthz) {
    return activityActionsForRole(auth.role).map((d) => ({
      name: d.id,
      title: d.title,
      description:
        d.risk === "SENSITIVE" ? `${d.description}(敏感操作:调用后生成确认单,需组织者在 Web 端批准后才生效)` : d.description,
      risk: d.risk,
      inputSchema: zodToJsonSchema(d.input),
    }));
  },

  async callTool(auth, name, args) {
    try {
      const outcome = await runActivityAction(name, args, {
        actorId: auth.actorId,
        actorName: auth.name,
        role: auth.role,
        source: "mcp",
      });
      if (outcome.kind === "executed") {
        return { text: JSON.stringify(outcome.result, null, 2), structured: { ok: true, ...outcome.result } };
      }
      return {
        text: `敏感操作已生成确认单,等待人工批准后才会执行。\n摘要:${outcome.summary}\n确认单:${outcome.confirmationId}\n批准入口:Web 端 /workbuddy(或 POST /api/confirmations/${outcome.confirmationId}/resolve,decision=approve,需组织者登录态)。\n过期时间:${outcome.expiresAt}`,
        structured: {
          ok: false,
          needsConfirmation: true,
          confirmationId: outcome.confirmationId,
          summary: outcome.summary,
          expiresAt: outcome.expiresAt,
        },
      };
    } catch (e) {
      if (e instanceof ControlError) {
        return { text: `[${e.code}] ${e.message}`, isError: true, structured: { ok: false, code: e.code } };
      }
      throw e;
    }
  },
};

export async function POST(req: Request) {
  return handleMcpRequest(req, backend);
}

export async function OPTIONS(req: Request) {
  return handleMcpRequest(req, backend);
}

export async function GET() {
  return Response.json(
    { error: "本端点为 MCP Streamable HTTP(JSON-RPC over POST)。请使用 MCP 客户端连接。" },
    { status: 405, headers: { Allow: "POST, OPTIONS" } }
  );
}

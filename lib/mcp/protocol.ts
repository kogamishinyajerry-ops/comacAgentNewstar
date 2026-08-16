// MCP(Model Context Protocol)Streamable HTTP 传输的 JSON-RPC 2.0 分发层。
// 协议逻辑与业务/存储解耦:后端通过 McpBackend 注入,便于单测与未来换传输(stdio 等)。
// 支持:initialize / notifications/* / ping / tools/list / tools/call。

import type { Role } from "../constants";

const SUPPORTED_PROTOCOL_VERSIONS = ["2024-11-05", "2025-03-26", "2025-06-18"];
const SERVER_PROTOCOL_VERSION = "2025-03-26";
export const SERVER_INFO = { name: "ynav-activity-control", title: "青年AI轻创活动控制 MCP Server", version: "1.0.0" } as const;

export interface McpToolInfo {
  name: string;
  title: string;
  description: string;
  risk: "SAFE" | "SENSITIVE";
  inputSchema: Record<string, unknown>;
}

export interface McpAuthz {
  /** 展示名:令牌名或用户名 */
  name: string;
  role: Role;
  /** 调用上下文 actorId:如 "mcp:wb_a1b2c3d4" */
  actorId: string;
}

export interface McpBackend {
  /** 返回 null 表示未认证(401) */
  auth(req: Request): Promise<McpAuthz | null>;
  listTools(auth: McpAuthz): McpToolInfo[];
  callTool(auth: McpAuthz, name: string, args: unknown): Promise<{ text: string; structured?: Record<string, unknown>; isError?: boolean }>;
}

type RpcRequest = { jsonrpc: string; id?: string | number | null; method: string; params?: Record<string, unknown> };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

function rpcResult(id: RpcRequest["id"], result: unknown, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, result }, { status, headers: CORS_HEADERS });
}

function rpcError(id: RpcRequest["id"], code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, { status, headers: CORS_HEADERS });
}

export async function handleMcpRequest(req: Request, backend: McpBackend): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") {
    return Response.json({ error: "MCP 端点仅支持 POST(JSON-RPC)" }, { status: 405, headers: CORS_HEADERS });
  }
  const auth = await backend.auth(req);
  if (!auth) {
    return Response.json(
      { error: "未认证:需要 Authorization: Bearer <MCP令牌>(在 /integrations 创建)或组织者登录态" },
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": "Bearer" } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "请求体不是合法 JSON", 400);
  }
  if (typeof body !== "object" || body === null || typeof (body as RpcRequest).method !== "string") {
    return rpcError(null, -32600, "请求不是合法的 JSON-RPC 消息", 400);
  }
  const rpc = body as RpcRequest;
  // 通知(无 id):接受即可,不回包
  if (rpc.id === undefined) return new Response(null, { status: 202, headers: CORS_HEADERS });

  switch (rpc.method) {
    case "initialize": {
      const requested = String((rpc.params as { protocolVersion?: unknown } | undefined)?.protocolVersion ?? "");
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SERVER_PROTOCOL_VERSION;
      return rpcResult(rpc.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_INFO.name, title: SERVER_INFO.title, version: SERVER_INFO.version },
        instructions: `青年AI轻创活动控制面。SAFE 工具直接返回结果;SENSITIVE 工具不会立即生效,会创建一张确认单(structuredContent.needsConfirmation=true),由组织者在 Web 端 /workbuddy 人工批准后按冻结参数执行。`,
      });
    }
    case "ping":
      return rpcResult(rpc.id, {});
    case "tools/list": {
      const tools = backend.listTools(auth).map((t) => ({
        name: t.name,
        title: t.title,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: { readOnlyHint: t.risk === "SAFE", destructiveHint: t.risk === "SENSITIVE", idempotentHint: t.risk === "SAFE" },
      }));
      return rpcResult(rpc.id, { tools });
    }
    case "tools/call": {
      const params = (rpc.params ?? {}) as { name?: unknown; arguments?: unknown };
      if (typeof params.name !== "string" || !params.name) return rpcError(rpc.id, -32602, "tools/call 需要 params.name");
      try {
        const out = await backend.callTool(auth, params.name, params.arguments ?? {});
        const result: Record<string, unknown> = {
          content: [{ type: "text", text: out.text }],
          ...(out.structured ? { structuredContent: out.structured } : {}),
        };
        if (out.isError) result.isError = true;
        return rpcResult(rpc.id, result);
      } catch (e) {
        // 工具执行失败按 MCP 规范返回 isError 结果,而不是协议错误
        return rpcResult(rpc.id, {
          content: [{ type: "text", text: `工具执行失败:${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(rpc.id, -32601, `未知方法:${rpc.method}`);
  }
}

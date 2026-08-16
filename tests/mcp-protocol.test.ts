// MCP Server:JSON-RPC 分发层(初始化/工具列表/调用/错误码/认证)
import { describe, expect, it } from "vitest";
import { handleMcpRequest, type McpBackend, type McpAuthz } from "../lib/mcp/protocol";

const AUTH: McpAuthz = { name: "测试令牌", role: "ORGANIZER", actorId: "mcp:wb_test" };

function backend(over: Partial<McpBackend> = {}): McpBackend {
  return {
    auth: async () => AUTH,
    listTools: () => [
      {
        name: "activity.overview",
        title: "活动总览",
        description: "查询全局快照",
        risk: "SAFE",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "announcement.publish",
        title: "发布公告",
        description: "发布",
        risk: "SENSITIVE",
        inputSchema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
      },
    ],
    callTool: async (_auth, name, args) =>
      name === "activity.overview"
        ? { text: '{"projectCounts":{"SUBMITTED":1}}', structured: { ok: true } }
        : { text: `敏感操作已生成确认单:${String((args as { title?: string }).title)}`, structured: { ok: false, needsConfirmation: true, confirmationId: "pa1" } },
    ...over,
  };
}

function rpc(method: string, params?: Record<string, unknown>, id: string | number = 1): Request {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
  });
}

describe("MCP 协议层", () => {
  it("未认证 → 401;GET → 405", async () => {
    const res = await handleMcpRequest(rpc("initialize"), backend({ auth: async () => null }));
    expect(res.status).toBe(401);
    const get = await handleMcpRequest(new Request("http://localhost/api/mcp", { method: "GET" }), backend());
    expect(get.status).toBe(405);
  });

  it("initialize 返回协议版本/能力/服务信息", async () => {
    const res = await handleMcpRequest(rpc("initialize", { protocolVersion: "2025-03-26" }), backend());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: Record<string, unknown> };
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.serverInfo).toMatchObject({ name: "ynav-activity-control" });
    expect((body.result.capabilities as { tools: unknown }).tools).toBeDefined();
  });

  it("不支持的协议版本回落到服务端版本", async () => {
    const res = await handleMcpRequest(rpc("initialize", { protocolVersion: "1999-01-01" }), backend());
    const body = (await res.json()) as { result: { protocolVersion: string } };
    expect(body.result.protocolVersion).toBe("2025-03-26");
  });

  it("通知(无 id)→202 无响应体", async () => {
    const notify = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    const res = await handleMcpRequest(notify, backend());
    expect(res.status).toBe(202);
    expect(await res.text()).toBe("");
  });

  it("tools/list 返回目录与注解(readOnlyHint/destructiveHint)", async () => {
    const res = await handleMcpRequest(rpc("tools/list"), backend());
    const body = (await res.json()) as { result: { tools: { name: string; annotations?: Record<string, boolean> }[] } };
    const names = body.result.tools.map((t) => t.name);
    expect(names).toContain("activity.overview");
    expect(names).toContain("announcement.publish");
    const overview = body.result.tools.find((t) => t.name === "activity.overview");
    expect(overview?.annotations?.readOnlyHint).toBe(true);
    const publish = body.result.tools.find((t) => t.name === "announcement.publish");
    expect(publish?.annotations?.destructiveHint).toBe(true);
  });

  it("tools/call:SAFE 返回结果;SENSITIVE 返回 needsConfirmation 结构化内容", async () => {
    const safe = await handleMcpRequest(rpc("tools/call", { name: "activity.overview", arguments: {} }), backend());
    const safeBody = (await safe.json()) as { result: { content: { type: string; text: string }[]; structuredContent: Record<string, unknown> } };
    expect(safeBody.result.content[0].type).toBe("text");
    expect(safeBody.result.structuredContent.ok).toBe(true);

    const sensitive = await handleMcpRequest(rpc("tools/call", { name: "announcement.publish", arguments: { title: "中期提醒" } }), backend());
    const sBody = (await sensitive.json()) as { result: { structuredContent: Record<string, unknown>; isError?: boolean } };
    expect(sBody.result.structuredContent.needsConfirmation).toBe(true);
    expect(sBody.result.structuredContent.confirmationId).toBe("pa1");
    expect(sBody.result.isError).toBeUndefined();
  });

  it("工具抛错 → isError 结果而非协议错误;未知方法 → -32601;坏 JSON → -32700", async () => {
    const failing = backend({ callTool: async () => { throw new Error("炸了"); } });
    const res = await handleMcpRequest(rpc("tools/call", { name: "x", arguments: {} }), failing);
    const body = (await res.json()) as { result: { isError: boolean; content: { text: string }[] } };
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("炸了");

    const unknown = await handleMcpRequest(rpc("wat/method"), backend());
    const uBody = (await unknown.json()) as { error: { code: number } };
    expect(uBody.error.code).toBe(-32601);

    const bad = await handleMcpRequest(
      new Request("http://localhost/api/mcp", { method: "POST", body: "{oops" }),
      backend()
    );
    expect(bad.status).toBe(400);
  });
});

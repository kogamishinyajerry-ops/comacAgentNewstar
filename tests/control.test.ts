// Activity Control:注册表核心(SAFE/SENSITIVE、权限确认状态机、冻结输入、过期)
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { findAction, listActionsForRole, resolveConfirmation, runAction, sweepExpired } from "../lib/control/registry";
import { zodToJsonSchema } from "../lib/control/zod-json";
import type { ActionDef, AnyActionDef, ControlDeps, ControlStore, PendingRecord } from "../lib/control/types";
import type { EventInput, StoredEvent } from "../lib/events/types";

const ORG = { actorId: "u-org", actorName: "组织者甲", role: "ORGANIZER" as const, source: "workbuddy" as const };
const PARTICIPANT = { actorId: "u-p", actorName: "参与者乙", role: "PARTICIPANT" as const, source: "web" as const };
const APPROVER = { id: "u-admin", name: "管理员丙", role: "ADMIN" as const };

function memoryStore(): ControlStore & { rows: PendingRecord[] } {
  const rows: PendingRecord[] = [];
  return {
    rows,
    async createPending(p) {
      const rec: PendingRecord = { id: `pa${rows.length + 1}`, status: "PENDING", createdAt: "2026-08-16T00:00:00.000Z", ...p };
      rows.push(rec);
      return rec;
    },
    async getPending(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async transitionPending(id, from, patch) {
      const r = rows.find((x) => x.id === id);
      if (!r || !from.includes(r.status)) return false;
      Object.assign(r, patch);
      return true;
    },
    async listPending(opts = {}) {
      return rows.filter((r) => (opts.status ? r.status === opts.status : true)).slice(0, opts.limit ?? 50);
    },
  };
}

interface TestDeps extends ControlDeps {
  events: EventInput[];
  audits: string[];
  advance(ms: number): void;
}

function makeDeps(over: Partial<ControlDeps> = {}): TestDeps {
  const events: EventInput[] = [];
  const audits: string[] = [];
  let clock = new Date("2026-08-16T00:00:00Z").getTime();
  return {
    events,
    audits,
    store: over.store ?? memoryStore(),
    emit: async (input) => {
      events.push(input);
      return {} as StoredEvent;
    },
    audit: async (_actor, action) => {
      audits.push(action);
    },
    now: over.now ?? (() => new Date(clock)),
    confirmTtlMs: over.confirmTtlMs,
    advance(ms: number) {
      clock += ms;
    },
  };
}

const ping: ActionDef<{ n: number }> = {
  id: "test.ping",
  title: "测试",
  description: "",
  risk: "SAFE",
  roles: ["ORGANIZER", "ADMIN"],
  input: z.object({ n: z.number().int().min(0).max(99) }),
  summary: (i) => `ping ${i.n}`,
  async execute(i, ctx) {
    return { pong: i.n, by: ctx.actorName };
  },
};

const drop: ActionDef<{ table: string }> = {
  id: "test.drop",
  title: "危险操作",
  description: "",
  risk: "SENSITIVE",
  roles: ["ORGANIZER", "ADMIN"],
  input: z.object({ table: z.string().min(1) }),
  summary: (i) => `清空表 ${i.table}`,
  async execute(i, ctx) {
    return { dropped: i.table, by: ctx.actorName };
  },
};

const boom: ActionDef = {
  id: "test.boom",
  title: "会失败",
  description: "",
  risk: "SENSITIVE",
  roles: ["ORGANIZER", "ADMIN"],
  input: z.object({}),
  summary: () => "会失败的操作",
  async execute() {
    throw new Error("执行炸了");
  },
};

const DEFS: AnyActionDef[] = [ping, drop, boom];

describe("Activity Control 注册表", () => {
  it("SAFE 动作直接执行并审计", async () => {
    const deps = makeDeps();
    const out = await runAction(DEFS, "test.ping", { n: 3 }, ORG, deps);
    expect(out).toEqual({ kind: "executed", result: { pong: 3, by: "组织者甲" } });
    expect(deps.audits).toContain("action.test.ping");
  });

  it("SENSITIVE 动动不执行,只创建确认单并发出 confirmation.requested", async () => {
    const deps = makeDeps();
    const out = await runAction(DEFS, "test.drop", { table: "users" }, ORG, deps);
    if (out.kind !== "needs_confirmation") throw new Error("应返回待确认");
    expect(out.summary).toBe("清空表 users");
    expect(out.expiresAt).toBeTruthy();
    expect(deps.events.map((e) => e.type)).toContain("confirmation.requested");
    expect(deps.audits).toContain("action.test.drop.pending");
  });

  it("角色不符 403;参数不合法 400;未知动作 404", async () => {
    const deps = makeDeps();
    await expect(runAction(DEFS, "test.ping", { n: 1 }, PARTICIPANT, deps)).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(runAction(DEFS, "test.ping", { n: -5 }, ORG, deps)).rejects.toMatchObject({ code: "BAD_INPUT", status: 400 });
    await expect(runAction(DEFS, "nope", {}, ORG, deps)).rejects.toMatchObject({ code: "UNKNOWN_ACTION", status: 404 });
  });

  it("批准后按冻结输入原样执行,确认单变为 EXECUTED", async () => {
    const deps = makeDeps();
    const out = await runAction(DEFS, "test.drop", { table: "logs" }, ORG, deps);
    if (out.kind !== "needs_confirmation") throw new Error("应返回待确认");
    const res = await resolveConfirmation(DEFS, out.confirmationId, APPROVER, "approve", "同意", deps);
    expect(res).toEqual({ kind: "executed", result: { dropped: "logs", by: "管理员丙" } });
    const row = (deps.store as unknown as { rows?: PendingRecord[] }).rows?.[0];
    expect(row?.status).toBe("EXECUTED");
    expect(deps.events.map((e) => e.type)).toContain("confirmation.executed");
  });

  it("拒绝后为 DENIED,不能再次处理;批准者角色不符 403", async () => {
    const deps = makeDeps();
    const out = await runAction(DEFS, "test.drop", { table: "x" }, ORG, deps);
    if (out.kind !== "needs_confirmation") throw new Error("应返回待确认");
    await expect(resolveConfirmation(DEFS, out.confirmationId, { id: "u-p", name: "参与者乙", role: "PARTICIPANT" }, "deny", undefined, deps)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const denied = await resolveConfirmation(DEFS, out.confirmationId, APPROVER, "deny", "不需要", deps);
    expect(denied).toEqual({ kind: "denied" });
    await expect(resolveConfirmation(DEFS, out.confirmationId, APPROVER, "approve", undefined, deps)).rejects.toMatchObject({ code: "NOT_PENDING", status: 409 });
  });

  it("过期确认单:批准时报 EXPIRED 并落 EXPIRED 状态;sweep 可批量清理", async () => {
    const deps = makeDeps({ confirmTtlMs: 1000 });
    const out = await runAction(DEFS, "test.drop", { table: "y" }, ORG, deps);
    if (out.kind !== "needs_confirmation") throw new Error("应返回待确认");
    deps.advance(2000);
    await expect(resolveConfirmation(DEFS, out.confirmationId, APPROVER, "approve", undefined, deps)).rejects.toMatchObject({ code: "EXPIRED", status: 410 });
    const row = (deps.store as unknown as { rows?: PendingRecord[] }).rows?.[0];
    expect(row?.status).toBe("EXPIRED");

    const deps2 = makeDeps({ confirmTtlMs: 1000 });
    const out2 = await runAction(DEFS, "test.drop", { table: "z" }, ORG, deps2);
    if (out2.kind !== "needs_confirmation") throw new Error("应返回待确认");
    deps2.advance(2000);
    expect(await sweepExpired(deps2)).toBe(1);
    expect((deps2.store as unknown as { rows?: PendingRecord[] }).rows?.[0]?.status).toBe("EXPIRED");
  });

  it("执行失败:确认单落 FAILED,不抛错而返回 failed 结果", async () => {
    const deps = makeDeps();
    const out = await runAction(DEFS, "test.boom", {}, ORG, deps);
    if (out.kind !== "needs_confirmation") throw new Error("应返回待确认");
    const res = await resolveConfirmation(DEFS, out.confirmationId, APPROVER, "approve", undefined, deps);
    expect(res).toMatchObject({ kind: "failed", error: "执行炸了" });
    expect((deps.store as unknown as { rows?: PendingRecord[] }).rows?.[0]?.status).toBe("FAILED");
  });

  it("listActionsForRole 按角色过滤;findAction 可定位", () => {
    expect(listActionsForRole(DEFS, "ORGANIZER")).toHaveLength(3);
    expect(listActionsForRole(DEFS, "PARTICIPANT")).toHaveLength(0);
    expect(findAction(DEFS, "test.ping")?.id).toBe("test.ping");
  });
});

describe("zodToJsonSchema(MCP/目录输入模式)", () => {
  it("对象/必填/枚举/默认值/描述转换正确", () => {
    const schema = zodToJsonSchema(
      z.object({
        mode: z.enum(["project", "user"]).describe("发送模式"),
        message: z.string().max(300).optional(),
        limit: z.number().optional(),
        pinned: z.boolean().default(false),
      })
    );
    expect(schema.type).toBe("object");
    expect((schema.properties as Record<string, Record<string, unknown>>).mode.enum).toEqual(["project", "user"]);
    expect((schema.properties as Record<string, Record<string, unknown>>).mode.description).toBe("发送模式");
    expect((schema.properties as Record<string, Record<string, unknown>>).message.maxLength).toBe(300);
    expect(schema.required).toEqual(["mode"]);
    expect((schema.properties as Record<string, Record<string, unknown>>).pinned.default).toBe(false);
  });

  it("未知类型兜底为空 schema", () => {
    expect(zodToJsonSchema(z.date())).toEqual({});
  });
});

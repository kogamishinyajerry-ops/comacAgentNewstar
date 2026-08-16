// 事件中心:总线(内存存储)的落库、订阅、游标过滤
import { describe, expect, it } from "vitest";
import { createEventBus, type EventStore } from "../lib/events/bus";
import type { EventInput, StoredEvent } from "../lib/events/types";
import { EVENT_TYPES, isEventType } from "../lib/events/types";

function memoryStore(): EventStore & { rows: StoredEvent[] } {
  const rows: StoredEvent[] = [];
  return {
    rows,
    async append(input: EventInput) {
      const event: StoredEvent = {
        id: `e${rows.length + 1}`,
        seq: rows.length + 1,
        type: input.type,
        payload: input.payload ?? {},
        actorId: input.actor?.id ?? null,
        actorName: input.actor?.name ?? "system",
        projectId: input.projectId ?? null,
        createdAt: new Date().toISOString(),
      };
      rows.push(event);
      return event;
    },
    async list(opts) {
      return rows
        .filter((r) => (opts.sinceSeq ? r.seq > opts.sinceSeq : true))
        .filter((r) => (opts.types?.length ? opts.types.includes(r.type) : true))
        .sort((a, b) => b.seq - a.seq)
        .slice(0, opts.limit);
    },
  };
}

describe("事件中心", () => {
  it("目录覆盖确认生命周期与项目/评审/配置事件", () => {
    expect(isEventType("project.submitted")).toBe(true);
    expect(isEventType("confirmation.requested")).toBe(true);
    expect(isEventType("not_a_type")).toBe(false);
    expect(EVENT_TYPES.length).toBeGreaterThanOrEqual(14);
  });

  it("emit 落库并通知订阅者,seq 单调递增", async () => {
    const store = memoryStore();
    const bus = createEventBus(store);
    const got: StoredEvent[] = [];
    bus.subscribe((e) => {
      got.push(e);
    });
    const e1 = await bus.emit({ type: "project.created", payload: { title: "A" }, actor: { id: "u1", name: "甲" } });
    const e2 = await bus.emit({ type: "project.submitted", payload: { title: "A" } });
    expect(e1.seq).toBe(1);
    expect(e2.seq).toBe(2);
    expect(store.rows).toHaveLength(2);
    expect(got).toHaveLength(2);
    expect(got[0].actorName).toBe("甲");
  });

  it("订阅者抛错不影响事件与其他订阅者", async () => {
    const store = memoryStore();
    const bus = createEventBus(store);
    const ok: string[] = [];
    bus.subscribe(() => {
      throw new Error("炸了");
    });
    bus.subscribe((e) => {
      ok.push(e.type);
    });
    await expect(bus.emit({ type: "review.locked" })).resolves.toBeTruthy();
    expect(store.rows).toHaveLength(1);
    expect(ok).toEqual(["review.locked"]);
  });

  it("list 支持 sinceSeq 游标与类型过滤,倒序返回", async () => {
    const bus = createEventBus(memoryStore());
    await bus.emit({ type: "project.created" });
    await bus.emit({ type: "notice.sent" });
    await bus.emit({ type: "project.submitted" });
    const since = await bus.list({ sinceSeq: 1, limit: 10 });
    expect(since.map((e) => e.seq)).toEqual([3, 2]);
    const onlyNotice = await bus.list({ types: ["notice.sent"], limit: 10 });
    expect(onlyNotice).toHaveLength(1);
    expect(onlyNotice[0].type).toBe("notice.sent");
  });
});

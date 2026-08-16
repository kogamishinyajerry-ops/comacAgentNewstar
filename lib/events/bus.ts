// 事件中心总线:先落库(追加日志,seq 单调递增),再通知进程内订阅者。
// 存储通过接口注入,便于单测用内存实现;默认使用 Prisma(SQLite)。

import { prisma } from "../db";
import { isEventType, type EventInput, type StoredEvent } from "./types";

export interface EventStore {
  append(input: EventInput): Promise<StoredEvent>;
  list(opts: { sinceSeq?: number; types?: string[]; limit: number }): Promise<StoredEvent[]>;
}

export type EventSubscriber = (event: StoredEvent) => void | Promise<void>;

class PrismaEventStore implements EventStore {
  async append(input: EventInput): Promise<StoredEvent> {
    // seq 手工分配(SQLite 不支持非主键自增);并发冲突靠重试
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prisma.$transaction(async (tx) => {
          const max = await tx.domainEvent.aggregate({ _max: { seq: true } });
          const row = await tx.domainEvent.create({
            data: {
              seq: (max._max.seq ?? 0) + 1,
              type: input.type,
              payload: JSON.stringify(input.payload ?? {}),
              actorId: input.actor?.id ?? null,
              actorName: input.actor?.name ?? "system",
              projectId: input.projectId ?? null,
            },
          });
          return toStored(row);
        });
      } catch (e) {
        const msg = String(e);
        if (attempt < 2 && /UNIQUE|P2034/i.test(msg)) continue;
        throw e;
      }
    }
    throw new Error("事件写入失败:seq 冲突重试耗尽");
  }

  async list(opts: { sinceSeq?: number; types?: string[]; limit: number }): Promise<StoredEvent[]> {
    const rows = await prisma.domainEvent.findMany({
      where: {
        ...(opts.sinceSeq ? { seq: { gt: opts.sinceSeq } } : {}),
        ...(opts.types && opts.types.length ? { type: { in: opts.types } } : {}),
      },
      orderBy: { seq: "desc" },
      take: Math.min(Math.max(opts.limit, 1), 200),
    });
    return rows.map(toStored);
  }
}

type EventRow = { id: string; seq: number; type: string; payload: string; actorId: string | null; actorName: string; projectId: string | null; createdAt: Date };

function toStored(row: EventRow): StoredEvent {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    /* 兜底为空对象 */
  }
  if (!isEventType(row.type)) payload = { ...payload, rawType: row.type };
  return {
    id: row.id,
    seq: row.seq,
    type: row.type as StoredEvent["type"],
    payload,
    actorId: row.actorId,
    actorName: row.actorName,
    projectId: row.projectId,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createEventBus(store: EventStore) {
  const subscribers = new Set<EventSubscriber>();
  let emitting = false;

  async function emit(input: EventInput): Promise<StoredEvent> {
    const event = await store.append(input);
    // 订阅者异常不回滚事件本身(日志是事实,订阅是衍生物)
    emitting = true;
    try {
      for (const fn of subscribers) {
        try {
          await fn(event);
        } catch (e) {
          console.error(`[events] 订阅者处理 ${event.type} 失败:`, e);
        }
      }
    } finally {
      emitting = false;
    }
    return event;
  }

  function subscribe(fn: EventSubscriber): () => void {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  return { emit, subscribe, list: (opts: { sinceSeq?: number; types?: string[]; limit: number }) => store.list(opts), isEmitting: () => emitting };
}

// ---------- 默认实例(Prisma 存储 + 内置订阅者) ----------

const globalForBus = globalThis as unknown as { __ynavEventBus?: ReturnType<typeof createEventBus> };

if (!globalForBus.__ynavEventBus) {
  const bus = createEventBus(new PrismaEventStore());
  // 内置订阅:有待确认的敏感动作 → 给全体组织者/管理员发站内通知(人机边界的"通知人"一环)
  bus.subscribe(async (event) => {
    if (event.type !== "confirmation.requested") return;
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ORGANIZER", "ADMIN"] } },
      select: { id: true },
    });
    if (admins.length === 0) return;
    await prisma.notice.createMany({
      data: admins.map((u) => ({
        userId: u.id,
        title: "待确认的敏感操作",
        body: String(event.payload.summary ?? "有一个 Activity Control 敏感动作等待人工确认。"),
        link: "/workbuddy",
      })),
    });
  });
  globalForBus.__ynavEventBus = bus;
}

export const eventBus = globalForBus.__ynavEventBus;
export const emitEvent = eventBus.emit;
export const listEvents = eventBus.list;

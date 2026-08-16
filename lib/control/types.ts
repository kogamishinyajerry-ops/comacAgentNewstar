// Activity Control:动作定义与运行时类型
// 一个动作 = 输入校验(Zod) + 角色 + 风险分级 + 人话摘要 + 执行器。
// SAFE 直接执行;SENSITIVE 先落 PendingAction 待人工确认(输入冻结)。

import type { z } from "zod";
import type { Role } from "../constants";
import type { EventInput, StoredEvent } from "../events/types";

export type RiskLevel = "SAFE" | "SENSITIVE";

export interface ActionContext {
  /** 发起者 userId,或 "agent:workbuddy" / "mcp:<prefix>" */
  actorId: string;
  actorName: string;
  role: Role;
  source: "web" | "workbuddy" | "mcp" | "api";
}

export interface ActionDef<I = Record<string, unknown>> {
  id: string;
  title: string;
  /** 给 LLM / MCP 客户端的工具说明:做什么、什么时候用 */
  description: string;
  risk: RiskLevel;
  /** 允许调用的角色 */
  roles: Role[];
  input: z.ZodType<I>;
  /** 一句话说明该输入将造成什么影响(确认页/通知/审计展示) */
  summary: (input: I) => string;
  /** 关联项目(用于事件与确认页跳转),无则返回 undefined */
  projectRef?: (input: I) => string | undefined;
  execute: (input: I, ctx: ActionContext) => Promise<Record<string, unknown>>;
}

/** 异构动作目录的类型(输入型变问题:execute/summary 以 I 为参数,ActionDef<A> 不能赋给 ActionDef<B>) */
export type AnyActionDef = ActionDef<any>;

/** ActionContext → 事件/审计的 actor */
export function actorOf(ctx: ActionContext): { id?: string; name: string } {
  return { id: ctx.actorId, name: ctx.actorName };
}

export type PendingStatus = "PENDING" | "DENIED" | "EXECUTED" | "FAILED" | "EXPIRED";

export interface PendingRecord {
  id: string;
  actionId: string;
  /** 冻结的输入 JSON 字符串 */
  input: string;
  summary: string;
  risk: string;
  requestedBy: string;
  requestedName: string;
  contextProjectId: string | null;
  status: PendingStatus;
  resolvedBy: string | null;
  resolvedName: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  executedAt: string | null;
  result: string | null;
  error: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface ControlStore {
  createPending(p: Omit<PendingRecord, "id" | "status" | "createdAt">): Promise<PendingRecord>;
  getPending(id: string): Promise<PendingRecord | null>;
  /** 条件更新(status 必须在 from 内),返回是否更新成功——并发安全的状态迁移 */
  transitionPending(id: string, from: PendingStatus[], patch: Partial<PendingRecord>): Promise<boolean>;
  listPending(opts: { status?: PendingStatus; limit?: number }): Promise<PendingRecord[]>;
}

export interface ControlDeps {
  store: ControlStore;
  emit: (input: EventInput) => Promise<StoredEvent>;
  audit: (actor: { id?: string; name: string } | null, action: string, targetType: string, targetId: string, detail?: string) => Promise<void>;
  now?: () => Date;
  /** 敏感确认单有效期(毫秒),默认 24 小时 */
  confirmTtlMs?: number;
}

export class ControlError extends Error {
  constructor(
    public code:
      | "UNKNOWN_ACTION"
      | "FORBIDDEN"
      | "BAD_INPUT"
      | "NOT_FOUND"
      | "NOT_PENDING"
      | "EXPIRED"
      | "EXECUTION_FAILED",
    public status: number,
    message: string,
    public detail?: unknown
  ) {
    super(message);
  }
}

export type RunOutcome =
  | { kind: "executed"; result: Record<string, unknown> }
  | { kind: "needs_confirmation"; confirmationId: string; summary: string; expiresAt: string };

export type ResolveOutcome =
  | { kind: "executed"; result: Record<string, unknown> }
  | { kind: "denied" }
  | { kind: "failed"; error: string };

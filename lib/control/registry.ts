// Activity Control 核心:runAction / resolveConfirmation 状态机(纯逻辑,存储注入)。
// 铁律:
//  1. SENSITIVE 动作绝不直接执行——只创建确认单并冻结输入;
//  2. 批准时按冻结的 input 原样执行,不接收任何"补丁参数";
//  3. 状态迁移用条件更新(PENDING→终态)保证一张确认单只被处理一次;
//  4. 全程审计 + 事件中心留痕。

import type { ActionContext, AnyActionDef, ControlDeps, PendingRecord, PendingStatus, ResolveOutcome, RunOutcome } from "./types";
import { ControlError as CE, actorOf } from "./types";

function nowOf(deps: ControlDeps): Date {
  return deps.now ? deps.now() : new Date();
}

export function findAction(defs: AnyActionDef[], actionId: string): AnyActionDef | undefined {
  return defs.find((d) => d.id === actionId);
}

function authorize(def: AnyActionDef, role: string): void {
  if (!def.roles.includes(role as AnyActionDef["roles"][number])) {
    throw new CE("FORBIDDEN", 403, `角色 ${role} 无权调用动作 ${def.id}`);
  }
}

function parseInput(def: AnyActionDef, raw: unknown): Record<string, unknown> {
  const parsed = def.input.safeParse(raw ?? {});
  if (!parsed.success) {
    throw new CE("BAD_INPUT", 400, `动作 ${def.id} 参数错误:${parsed.error.issues[0]?.message ?? "格式不合法"}`, parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data as Record<string, unknown>;
}

async function persistOutcome(deps: ControlDeps, pending: PendingRecord, patch: Partial<PendingRecord>, event: { type: "confirmation.executed" | "confirmation.denied" | "confirmation.expired"; payload: Record<string, unknown> }, actor: { id?: string; name: string }) {
  const ok = await deps.store.transitionPending(pending.id, ["PENDING"], patch);
  if (!ok) throw new CE("NOT_PENDING", 409, "该确认单已被处理");
  await deps.audit(actor, `confirmation.${patch.status === "EXECUTED" ? "execute" : patch.status === "DENIED" ? "deny" : "expire"}`.toLowerCase(), "PendingAction", pending.id, pending.summary);
  await deps.emit({
    type: event.type,
    payload: { confirmationId: pending.id, actionId: pending.actionId, summary: pending.summary, ...event.payload },
    actor,
    projectId: pending.contextProjectId,
  });
}

/** 调用一个动作:SAFE 直接执行;SENSITIVE 创建待确认单 */
export async function runAction(
  defs: AnyActionDef[],
  actionId: string,
  rawInput: unknown,
  ctx: ActionContext,
  deps: ControlDeps
): Promise<RunOutcome> {
  const def = findAction(defs, actionId);
  if (!def) throw new CE("UNKNOWN_ACTION", 404, `未知动作:${actionId}`);
  authorize(def, ctx.role);
  const input = parseInput(def, rawInput);

  if (def.risk === "SAFE") {
    const result = await def.execute(input, ctx);
    await deps.audit(actorOf(ctx), `action.${def.id}`, "ActivityControl", def.id, JSON.stringify(input).slice(0, 300));
    return { kind: "executed", result };
  }

  const now = nowOf(deps);
  const expiresAt = new Date(now.getTime() + (deps.confirmTtlMs ?? 24 * 3600 * 1000));
  const summary = def.summary(input);
  const pending = await deps.store.createPending({
    actionId: def.id,
    input: JSON.stringify(input),
    summary,
    risk: def.risk,
    requestedBy: ctx.actorId,
    requestedName: ctx.actorName,
    contextProjectId: def.projectRef?.(input) ?? null,
    resolvedBy: null,
    resolvedName: null,
    resolvedAt: null,
    resolutionNote: null,
    executedAt: null,
    result: null,
    error: null,
    expiresAt: expiresAt.toISOString(),
  });
  await deps.audit(actorOf(ctx), `action.${def.id}.pending`, "PendingAction", pending.id, summary);
  await deps.emit({
    type: "confirmation.requested",
    payload: { confirmationId: pending.id, actionId: def.id, summary, requestedName: ctx.actorName, source: ctx.source },
    actor: actorOf(ctx),
    projectId: pending.contextProjectId,
  });
  return { kind: "needs_confirmation", confirmationId: pending.id, summary, expiresAt: expiresAt.toISOString() };
}

/** 人工处理确认单:approve=按冻结输入执行;deny=拒绝。每单只能处理一次。 */
export async function resolveConfirmation(
  defs: AnyActionDef[],
  confirmationId: string,
  approver: { id: string; name: string; role: ActionContext["role"] },
  decision: "approve" | "deny",
  note: string | undefined,
  deps: ControlDeps
): Promise<ResolveOutcome> {
  const pending = await deps.store.getPending(confirmationId);
  if (!pending) throw new CE("NOT_FOUND", 404, "确认单不存在");
  if (pending.status !== "PENDING") throw new CE("NOT_PENDING", 409, `该确认单已处理(${pending.status})`);
  const now = nowOf(deps);
  if (pending.expiresAt && new Date(pending.expiresAt).getTime() < now.getTime()) {
    await persistOutcome(deps, pending, { status: "EXPIRED" }, { type: "confirmation.expired", payload: { reason: "过期未确认" } }, approver);
    throw new CE("EXPIRED", 410, "确认单已过期,请重新发起");
  }

  const def = findAction(defs, pending.actionId);
  if (!def) {
    await deps.store.transitionPending(confirmationId, ["PENDING"], { status: "FAILED", error: "动作已下线,无法执行", resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString() });
    throw new CE("EXECUTION_FAILED", 410, "该动作已下线");
  }
  authorize(def, approver.role);
  const ctx: ActionContext = { actorId: approver.id, actorName: approver.name, role: approver.role, source: "web" };

  if (decision === "deny") {
    await persistOutcome(
      deps,
      pending,
      { status: "DENIED", resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString(), resolutionNote: note ?? null },
      { type: "confirmation.denied", payload: { by: approver.name, note: note ?? "" } },
      approver
    );
    return { kind: "denied" };
  }

  // 批准:严格按冻结输入重新校验后执行
  let frozen: unknown;
  try {
    frozen = JSON.parse(pending.input);
  } catch {
    await deps.store.transitionPending(confirmationId, ["PENDING"], { status: "FAILED", error: "冻结输入损坏", resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString() });
    throw new CE("EXECUTION_FAILED", 500, "冻结输入损坏");
  }
  const reparsed = def.input.safeParse(frozen);
  if (!reparsed.success) {
    await deps.store.transitionPending(confirmationId, ["PENDING"], { status: "FAILED", error: "冻结输入不符合当前校验规则", resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString() });
    throw new CE("EXECUTION_FAILED", 409, "冻结输入不符合当前校验规则,已作废");
  }

  try {
    const result = await def.execute(reparsed.data as Record<string, unknown>, ctx);
    await persistOutcome(
      deps,
      pending,
      { status: "EXECUTED", resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString(), resolutionNote: note ?? null, executedAt: now.toISOString(), result: JSON.stringify(result) },
      { type: "confirmation.executed", payload: { by: approver.name, ok: true } },
      approver
    );
    return { kind: "executed", result };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await deps.store.transitionPending(confirmationId, ["PENDING"], { status: "FAILED", error: message.slice(0, 500), resolvedBy: approver.id, resolvedName: approver.name, resolvedAt: now.toISOString() });
    await deps.emit({
      type: "confirmation.executed",
      payload: { confirmationId: pending.id, actionId: pending.actionId, summary: pending.summary, by: approver.name, ok: false, error: message.slice(0, 200) },
      actor: approver,
      projectId: pending.contextProjectId,
    });
    return { kind: "failed", error: message };
  }
}

/** 把已经过期但仍是 PENDING 的确认单扫成 EXPIRED(列表/详情前调用) */
export async function sweepExpired(deps: ControlDeps, ids?: string[]): Promise<number> {
  const now = nowOf(deps).getTime();
  const list = ids
    ? (await Promise.all(ids.map((id) => deps.store.getPending(id)))).filter((p): p is PendingRecord => !!p)
    : await deps.store.listPending({ status: "PENDING", limit: 100 });
  let n = 0;
  for (const p of list) {
    if (p.expiresAt && new Date(p.expiresAt).getTime() < now) {
      const ok = await deps.store.transitionPending(p.id, ["PENDING"], { status: "EXPIRED" });
      if (ok) {
        n++;
        await deps.emit({ type: "confirmation.expired", payload: { confirmationId: p.id, actionId: p.actionId, summary: p.summary, reason: "过期未确认" }, projectId: p.contextProjectId });
      }
    }
  }
  return n;
}

export function listActionsForRole(defs: AnyActionDef[], role: string): AnyActionDef[] {
  return defs.filter((d) => d.roles.includes(role as AnyActionDef["roles"][number]));
}



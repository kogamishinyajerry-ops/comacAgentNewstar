// Activity Control 出入口:Prisma 存储 + 事件中心 + 审计的默认装配。
// 路由层与 WorkBuddy 一律经由这里调用,保证三个面(REST/MCP/Agent)行为一致。

import { prisma } from "../db";
import { audit } from "../auth";
import { eventBus } from "../events/bus";
import { ACTIONS } from "./actions";
import { listActionsForRole, resolveConfirmation, runAction, sweepExpired } from "./registry";
import type { ActionContext, AnyActionDef, ControlDeps, ControlStore, PendingRecord, PendingStatus, ResolveOutcome, RunOutcome } from "./types";

type PendingRow = {
  id: string; actionId: string; input: string; summary: string; risk: string;
  requestedBy: string; requestedName: string; contextProjectId: string | null;
  status: string; resolvedBy: string | null; resolvedName: string | null; resolvedAt: Date | null;
  resolutionNote: string | null; executedAt: Date | null; result: string | null; error: string | null;
  expiresAt: Date | null; createdAt: Date;
};

function toRecord(row: PendingRow): PendingRecord {
  return {
    id: row.id,
    actionId: row.actionId,
    input: row.input,
    summary: row.summary,
    risk: row.risk,
    requestedBy: row.requestedBy,
    requestedName: row.requestedName,
    contextProjectId: row.contextProjectId,
    status: row.status as PendingStatus,
    resolvedBy: row.resolvedBy,
    resolvedName: row.resolvedName,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolutionNote: row.resolutionNote,
    executedAt: row.executedAt?.toISOString() ?? null,
    result: row.result,
    error: row.error,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

class PrismaControlStore implements ControlStore {
  async createPending(p: Omit<PendingRecord, "id" | "status" | "createdAt">): Promise<PendingRecord> {
    const row = await prisma.pendingAction.create({
      data: {
        actionId: p.actionId,
        input: p.input,
        summary: p.summary,
        risk: p.risk,
        requestedBy: p.requestedBy,
        requestedName: p.requestedName,
        contextProjectId: p.contextProjectId,
        expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
      },
    });
    return toRecord(row);
  }

  async getPending(id: string): Promise<PendingRecord | null> {
    const row = await prisma.pendingAction.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async transitionPending(id: string, from: PendingStatus[], patch: Partial<PendingRecord>): Promise<boolean> {
    const data: Record<string, unknown> = {};
    if (patch.status) data.status = patch.status;
    if (patch.resolvedBy !== undefined) data.resolvedBy = patch.resolvedBy;
    if (patch.resolvedName !== undefined) data.resolvedName = patch.resolvedName;
    if (patch.resolutionNote !== undefined) data.resolutionNote = patch.resolutionNote;
    if (patch.executedAt !== undefined) data.executedAt = patch.executedAt ? new Date(patch.executedAt) : null;
    if (patch.resolvedAt !== undefined) data.resolvedAt = patch.resolvedAt ? new Date(patch.resolvedAt) : null;
    if (patch.result !== undefined) data.result = patch.result;
    if (patch.error !== undefined) data.error = patch.error;
    const res = await prisma.pendingAction.updateMany({ where: { id, status: { in: from } }, data });
    return res.count === 1;
  }

  async listPending(opts: { status?: PendingStatus; limit?: number }): Promise<PendingRecord[]> {
    const rows = await prisma.pendingAction.findMany({
      where: opts.status ? { status: opts.status } : undefined,
      orderBy: { createdAt: "desc" },
      take: Math.min(opts.limit ?? 50, 200),
    });
    return rows.map(toRecord);
  }
}

export const controlDeps: ControlDeps = {
  store: new PrismaControlStore(),
  emit: eventBus.emit,
  audit,
};

export function runActivityAction(actionId: string, input: unknown, ctx: ActionContext): Promise<RunOutcome> {
  return runAction(ACTIONS, actionId, input, ctx, controlDeps);
}

export function resolveActivityConfirmation(
  confirmationId: string,
  approver: { id: string; name: string; role: ActionContext["role"] },
  decision: "approve" | "deny",
  note?: string
): Promise<ResolveOutcome> {
  return resolveConfirmation(ACTIONS, confirmationId, approver, decision, note, controlDeps);
}

export function sweepActivityExpired(): Promise<number> {
  return sweepExpired(controlDeps);
}

export async function listActivityPending(opts: { status?: PendingStatus; limit?: number } = {}): Promise<PendingRecord[]> {
  if (!opts.status) await sweepActivityExpired();
  return controlDeps.store.listPending(opts);
}

export function activityActionsForRole(role: string): AnyActionDef[] {
  return listActionsForRole(ACTIONS, role);
}

export { ACTIONS } from "./actions";
export type { AnyActionDef } from "./types";

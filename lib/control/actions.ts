// Activity Control 动作目录:组织侧全部控制能力的单一事实源。
// REST(/api/control)、MCP(/api/mcp tools)、WorkBuddy(总控 Agent 工具)三个面共享本目录。

import { z } from "zod";
import { prisma } from "../db";
import { TRACK_KEYS } from "../constants";
import { emitEvent, listEvents } from "../events/bus";
import { loadProjectBundle } from "../projects";
import { computeProjectProgress } from "../progress";
import type { ActionDef } from "./types";
import { actorOf } from "./types";

const ORGANIZER_ROLES = ["ORGANIZER", "ADMIN"] as const;

// ---------- 只读(SAFE) ----------

export const activityOverview: ActionDef = {
  id: "activity.overview",
  title: "活动总览",
  description: "查询活动全局快照:活动配置(名称/日期/截止)、各状态项目计数、队伍数、待确认敏感操作数、最近领域事件,以及项目清单(含 id/标题/状态/队伍;草稿只有摘要,无材料全文)。回答『活动进展如何/有多少提交』,或催办与状态变更前查找 projectId,先用它。",
  risk: "SAFE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({}).passthrough(),
  summary: () => "查询活动总览",
  async execute() {
    const [config, byStatus, teams, judges, pending, recent, projects] = await Promise.all([
      prisma.activityConfig.findUnique({ where: { id: "main" } }),
      prisma.ideaProject.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.team.count(),
      prisma.user.count({ where: { role: "JUDGE" } }),
      prisma.pendingAction.count({ where: { status: "PENDING" } }),
      listEvents({ limit: 8 }),
      prisma.ideaProject.findMany({
        select: { id: true, title: true, status: true, track: true, currentStep: true, updatedAt: true, team: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
    ]);
    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[row.status] = row._count._all;
    return {
      activity: config
        ? { name: config.name, slogan: config.slogan, startDate: config.startDate, endDate: config.endDate, submissionDeadline: config.submissionDeadline }
        : null,
      projectCounts: counts,
      teamCount: teams,
      judgeCount: judges,
      pendingConfirmations: pending,
      recentEvents: recent.map((e) => ({ seq: e.seq, type: e.type, summary: e.payload.summary ?? null, actorName: e.actorName, at: e.createdAt })),
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        track: p.track,
        currentStep: p.currentStep,
        team: p.team.name,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  },
};

export const eventsRecent: ActionDef<{ types?: string[]; limit?: number }> = {
  id: "events.recent",
  title: "最近事件",
  description: "查询事件中心最近的领域事件(提交/状态变更/公告/评审/确认生命周期等),可按类型过滤。用于排查『刚才发生了什么』;返回的是事件流水,不含项目清单,不能用来查 projectId。",
  risk: "SAFE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({
    types: z.array(z.string()).max(10).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }).passthrough(),
  summary: () => "查询最近事件",
  async execute(input) {
    const events = await listEvents({ types: input.types, limit: input.limit ?? 15 });
    return { events: events.map((e) => ({ seq: e.seq, type: e.type, payload: e.payload, actorName: e.actorName, projectId: e.projectId, at: e.createdAt })) };
  },
};

// ---------- 敏感控制(SENSITIVE,需人工确认) ----------

export const activityUpdateConfig: ActionDef<{
  name?: string; slogan?: string; intro?: string; startDate?: string; endDate?: string; submissionDeadline?: string;
}> = {
  id: "activity.updateConfig",
  title: "修改活动配置",
  description: "修改活动基本信息(名称/口号/简介/起止日期/提交截止时间)。只传需要修改的字段,未传字段保持不变。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({
    name: z.string().trim().min(1).max(60).optional(),
    slogan: z.string().trim().min(1).max(100).optional(),
    intro: z.string().trim().max(500).optional(),
    startDate: z.string().trim().max(20).optional(),
    endDate: z.string().trim().max(20).optional(),
    submissionDeadline: z.string().trim().max(30).optional(),
  }),
  summary: (i) => `修改活动配置:${Object.entries(i).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => `${k}→${String(v).slice(0, 30)}`).join("、") || "(无变化)"}`,
  async execute(input, ctx) {
    const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined && v !== ""));
    const config = await prisma.activityConfig.upsert({
      where: { id: "main" },
      update: patch,
      create: { id: "main", ...patch },
    });
    await emitEvent({ type: "activity.config_updated", payload: { fields: Object.keys(patch) }, actor: actorOf(ctx) });
    return { ok: true, config: { name: config.name, slogan: config.slogan, submissionDeadline: config.submissionDeadline } };
  },
};

export const announcementPublish: ActionDef<{ title: string; body: string; pinned?: boolean }> = {
  id: "announcement.publish",
  title: "发布公告",
  description: "向全站发布一条公告。pinned=true 会置顶。公告面向所有参与者,发布前请确认措辞。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().min(1).max(2000),
    pinned: z.boolean().optional(),
  }),
  summary: (i) => `发布公告《${i.title.slice(0, 40)}》${i.pinned ? "(置顶)" : ""}`,
  async execute(input, ctx) {
    const row = await prisma.announcement.create({ data: { title: input.title, body: input.body, pinned: input.pinned ?? false } });
    await emitEvent({ type: "announcement.published", payload: { announcementId: row.id, title: row.title, pinned: row.pinned }, actor: actorOf(ctx) });
    return { ok: true, announcementId: row.id };
  },
};

export const noticeSend: ActionDef<{ mode: "project" | "user"; projectId?: string; userId?: string; message?: string }> = {
  id: "notice.send",
  title: "发送站内通知",
  description: "发送站内通知。mode=project 向某项目全体成员发送温和提醒(不传 message 时自动生成含最小下一步的默认话术);mode=user 发给指定用户。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z
    .object({
      mode: z.enum(["project", "user"]),
      projectId: z.string().min(1).optional(),
      userId: z.string().min(1).optional(),
      message: z.string().trim().max(300).optional(),
    })
    .refine((i) => (i.mode === "project" ? !!i.projectId : !!i.userId), { message: "project 模式必填 projectId,user 模式必填 userId" }),
  summary: (i) =>
    i.mode === "project"
      ? `向项目成员发送提醒${i.message ? `:「${i.message.slice(0, 40)}」` : "(默认温和话术)"}`
      : `向用户 ${i.userId} 发送通知${i.message ? `:「${i.message.slice(0, 40)}」` : ""}`,
  projectRef: (i) => (i.mode === "project" ? i.projectId : undefined),
  async execute(input, ctx) {
    if (input.mode === "user") {
      const user = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) throw new Error("用户不存在");
      await prisma.notice.create({
        data: { userId: user.id, title: "组织者通知", body: input.message?.trim() || "(组织者向你发送了一条通知)" },
      });
      await emitEvent({ type: "notice.sent", payload: { to: 1, mode: "user" }, actor: actorOf(ctx) });
      return { ok: true, sent: 1 };
    }
    const bundle = await loadProjectBundle(input.projectId!);
    if (!bundle) throw new Error("项目不存在");
    if (["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"].includes(bundle.project.status)) {
      throw new Error("该作品已提交/归档,无需催办");
    }
    const progress = computeProjectProgress(bundle, {
      feedbackCount: await prisma.agentFeedback.count({ where: { projectId: bundle.project.id } }),
      hasSnapshot: (await prisma.submissionSnapshot.count({ where: { projectId: bundle.project.id } })) > 0,
    });
    const message =
      input.message?.trim() ||
      `「${bundle.project.title}」当前的最新进展已同步给组织者。此刻最小下一步:${progress.nextHint}。按自己的节奏推进即可,遇到卡点欢迎来 Office Hour 或在项目页找专职Agent聊一聊。`;
    await prisma.notice.createMany({
      data: bundle.members.map((m) => ({
        userId: m.userId,
        title: `组织者提醒:${bundle.project.title}`,
        body: message,
        link: `/projects/${bundle.project.id}?step=${progress.currentStep}`,
      })),
    });
    await emitEvent({ type: "notice.sent", payload: { projectId: bundle.project.id, title: bundle.project.title, to: bundle.members.length, mode: "project" }, actor: actorOf(ctx), projectId: bundle.project.id });
    return { ok: true, sent: bundle.members.length };
  },
};

const STATUS_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  return: { from: ["SUBMITTED", "PRELIMINARY"], to: "RETURNED" },
  preliminary: { from: ["SUBMITTED"], to: "PRELIMINARY" },
  final: { from: ["PRELIMINARY"], to: "FINAL" },
  archive: { from: ["FINAL", "PRELIMINARY", "RETURNED", "SUBMITTED"], to: "ARCHIVED" },
};

export const projectSetStatus: ActionDef<{ projectId: string; action: "return" | "preliminary" | "final" | "archive"; reason?: string }> = {
  id: "project.setStatus",
  title: "变更项目状态",
  description: "变更项目评审状态:return=退回补充(必须给 reason)、preliminary=进入预赛、final=进入决赛、archive=归档。状态机与组织者后台一致。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z
    .object({
      projectId: z.string().min(1),
      action: z.enum(["return", "preliminary", "final", "archive"]),
      reason: z.string().trim().max(500).optional(),
    })
    .refine((i) => i.action !== "return" || !!i.reason?.trim(), { message: "退回补充必须填写原因" }),
  summary: (i) => `项目状态变更为 ${i.action}${i.reason ? `,原因:${i.reason.slice(0, 40)}` : ""}`,
  projectRef: (i) => i.projectId,
  async execute(input, ctx) {
    const project = await prisma.ideaProject.findUnique({ where: { id: input.projectId } });
    if (!project) throw new Error("项目不存在");
    const t = STATUS_TRANSITIONS[input.action];
    if (!t.from.includes(project.status)) throw new Error(`当前状态(${project.status})不允许该操作`);
    await prisma.ideaProject.update({
      where: { id: input.projectId },
      data: { status: t.to, returnReason: input.action === "return" ? input.reason : null },
    });
    await emitEvent({
      type: "project.status_changed",
      payload: { projectId: project.id, title: project.title, from: project.status, to: t.to, reason: input.reason ?? null },
      actor: actorOf(ctx),
      projectId: project.id,
    });
    return { ok: true, status: t.to };
  },
};

export const reviewAssign: ActionDef<{ projectId: string; judgeId: string; round: "PRELIMINARY" | "FINAL" }> = {
  id: "review.assign",
  title: "分配评委",
  description: "把一个项目分配给某评委评审(round=PRELIMINARY 预赛 / FINAL 决赛)。同一轮重复分配会被拒绝。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({
    projectId: z.string().min(1),
    judgeId: z.string().min(1),
    round: z.enum(["PRELIMINARY", "FINAL"]),
  }),
  summary: (i) => `分配评委 ${i.judgeId} 评审项目 ${i.projectId}(${i.round === "PRELIMINARY" ? "预赛" : "决赛"})`,
  projectRef: (i) => i.projectId,
  async execute(input, ctx) {
    const [project, judge] = await Promise.all([
      prisma.ideaProject.findUnique({ where: { id: input.projectId } }),
      prisma.user.findUnique({ where: { id: input.judgeId } }),
    ]);
    if (!project) throw new Error("项目不存在");
    if (!judge || judge.role !== "JUDGE") throw new Error("该用户不是评委");
    const exists = await prisma.reviewAssignment.findFirst({ where: { projectId: input.projectId, judgeId: input.judgeId, round: input.round } });
    if (exists) throw new Error("该评委已在此轮被分配过此项目");
    const row = await prisma.reviewAssignment.create({ data: { projectId: input.projectId, judgeId: input.judgeId, round: input.round } });
    await emitEvent({
      type: "review.assigned",
      payload: { assignmentId: row.id, projectId: project.id, title: project.title, judgeId: judge.id, judgeName: judge.name, round: input.round },
      actor: actorOf(ctx),
      projectId: project.id,
    });
    return { ok: true, assignmentId: row.id };
  },
};

export const trackToggle: ActionDef<{ trackId: string; enabled: boolean }> = {
  id: "track.toggle",
  title: "启停赛道",
  description: "启用或停用一个赛道(共4个固定赛道:personal-efficiency / knowledge-qa / process-automation / engineering-agent)。停用后参与者不可再选择该赛道。",
  risk: "SENSITIVE",
  roles: [...ORGANIZER_ROLES],
  input: z.object({
    trackId: z.enum(["personal-efficiency", "knowledge-qa", "process-automation", "engineering-agent"]),
    enabled: z.boolean(),
  }),
  summary: (i) => `${i.enabled ? "启用" : "停用"}赛道 ${i.trackId}`,
  async execute(input, ctx) {
    void TRACK_KEYS;
    const row = await prisma.trackConfig.update({ where: { id: input.trackId }, data: { enabled: input.enabled } });
    await emitEvent({ type: "track.toggled", payload: { trackId: row.id, enabled: row.enabled }, actor: actorOf(ctx) });
    return { ok: true, trackId: row.id, enabled: row.enabled };
  },
};

export const ACTIONS: import("./types").AnyActionDef[] = [
  activityOverview,
  eventsRecent,
  activityUpdateConfig,
  announcementPublish,
  noticeSend,
  projectSetStatus,
  reviewAssign,
  trackToggle,
];

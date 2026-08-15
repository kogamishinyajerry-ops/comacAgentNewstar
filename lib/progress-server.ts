// 进度数据的服务端装配:参与者工作台与组织者进展中枢共用

import { prisma } from "./db";
import { computeProjectProgress, blockerSummary, type ProjectProgress } from "./progress";

export interface ProjectProgressRow {
  projectId: string;
  title: string;
  teamName: string;
  memberNames: string[];
  memberIds: string[];
  status: string;
  track: string | null;
  progress: ProjectProgress;
  blocker: string;
  submittedAt: string | null;
  /** 成就系统所需 */
  feedbackCount: number;
  hasSnapshot: boolean;
  hasDocumentedFailure: boolean;
}

async function buildRow(row: {
  id: string;
  title: string;
  status: string;
  track: string | null;
  returnReason: string | null;
  createdAt: Date;
  submittedAt: Date | null;
  team: { name: string; members: { userId: string; user: { name: string } }[] };
  stages: { step: number; data: string; updatedAt: Date }[];
  testCases: { name: string; type: string; input: string; expected: string; verdict?: string; failureReason?: string; createdAt: Date }[];
  _count?: { agentFeedbacks: number; snapshots: number };
}): Promise<ProjectProgressRow> {
  const feedbackTimes = (
    await prisma.agentFeedback.findMany({
      where: { projectId: row.id },
      select: { createdAt: true },
      take: 200,
    })
  ).map((f) => f.createdAt);
  const progress = computeProjectProgress(
    {
      project: {
        title: row.title,
        track: row.track,
        status: row.status,
        returnReason: row.returnReason,
        createdAt: row.createdAt,
        submittedAt: row.submittedAt,
      },
      team: {},
      stages: row.stages,
      testCases: row.testCases,
      stageTimes: row.stages.map((s) => s.updatedAt),
      testTimes: row.testCases.map((t) => t.createdAt),
      feedbackTimes,
    },
    { feedbackCount: row._count?.agentFeedbacks ?? 0, hasSnapshot: (row._count?.snapshots ?? 0) > 0 }
  );
  return {
    projectId: row.id,
    title: row.title,
    teamName: row.team.name,
    memberNames: row.team.members.map((m) => m.user.name),
    memberIds: row.team.members.map((m) => m.userId),
    status: row.status,
    track: row.track,
    progress,
    blocker: blockerSummary(progress, row.status),
    submittedAt: row.submittedAt?.toISOString() ?? null,
    feedbackCount: row._count?.agentFeedbacks ?? 0,
    hasSnapshot: (row._count?.snapshots ?? 0) > 0,
    hasDocumentedFailure: row.testCases.some(
      (t) => (t.type === "FAILURE" || t.type === "NA") && !!t.failureReason?.trim()
    ),
  };
}

const includeFor = {
  team: { include: { members: { include: { user: { select: { name: true } } } } } },
  stages: { select: { step: true, data: true, updatedAt: true } },
  testCases: { select: { name: true, type: true, input: true, expected: true, verdict: true, failureReason: true, createdAt: true } },
  _count: { select: { agentFeedbacks: true, snapshots: true } },
} as const;

/** 参与者工作台数据 */
export async function participantWorkspace(userId: string) {
  const membership = await prisma.teamMember.findFirst({
    where: { userId },
    include: { team: true },
  });
  const projects = membership
    ? await prisma.ideaProject.findMany({
        where: { teamId: membership.teamId },
        orderBy: { updatedAt: "desc" },
        include: includeFor,
      })
    : [];
  const rows = await Promise.all(projects.map(buildRow));

  const [notices, announcements, config] = await Promise.all([
    prisma.notice.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 2 }),
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
  ]);

  // 未处理的Agent建议数(最近一次各步反馈中未标记采纳/忽略/已处理的)
  let pendingSuggestions = 0;
  if (membership) {
    const feedbacks = await prisma.agentFeedback.findMany({
      where: { project: { teamId: membership.teamId } },
      select: { suggestionStates: true },
    });
    for (const f of feedbacks) {
      try {
        const states = JSON.parse(f.suggestionStates || "{}") as Record<string, string>;
        pendingSuggestions += Object.keys(states).filter((k) => !["adopted", "ignored", "done"].includes(states[k])).length;
      } catch {
        /* ignore */
      }
    }
  }

  return {
    team: membership
      ? { id: membership.team.id, name: membership.team.name, inviteCode: membership.team.inviteCode, mode: membership.team.mode }
      : null,
    rows,
    notices: notices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
    announcements: announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, createdAt: a.createdAt.toISOString() })),
    deadline: config?.submissionDeadline ?? null,
    officeHour: await prisma.officeHour.findFirst({ orderBy: { createdAt: "desc" } }),
    pendingSuggestions,
  };
}

/** 组织者进展中枢数据:全量矩阵 + 漏斗 + 预警 */
export async function organizerProgress() {
  const rowsRaw = await prisma.ideaProject.findMany({ orderBy: { updatedAt: "desc" }, include: includeFor });
  const rows = await Promise.all(rowsRaw.map(buildRow));

  const [participants, teams, config] = await Promise.all([
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
    prisma.team.count(),
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
  ]);

  const inWork = (r: ProjectProgressRow) => !["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"].includes(r.status);
  const funnel = {
    participants,
    teamed: teams,
    projects: rows.length,
    coreDone: rows.filter((r) => [4, 5, 6].every((s) => r.progress.steps.find((x) => x.step === s)?.status === "done")).length,
    testsOk: rows.filter((r) => r.progress.tests.passOk && r.progress.tests.coverageOk).length,
    submitted: rows.filter((r) => ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(r.status)).length,
    archived: rows.filter((r) => r.status === "ARCHIVED").length,
  };

  const deadline = config?.submissionDeadline ?? null;
  let daysToDeadline: number | null = null;
  if (deadline) {
    const d = new Date(deadline.replace(/(\d{4}-\d{2}-\d{2}).*/, "$1") + "T23:59:59");
    if (!Number.isNaN(d.getTime())) daysToDeadline = Math.ceil((d.getTime() - Date.now()) / 86400000);
  }

  return {
    rows,
    funnel,
    deadline,
    daysToDeadline,
    alerts: {
      stale: rows.filter((r) => inWork(r) && r.progress.staleDays >= 5).sort((a, b) => b.progress.staleDays - a.progress.staleDays),
      nearDeadline: daysToDeadline != null && daysToDeadline <= 7 ? rows.filter((r) => inWork(r)) : [],
      returnedPending: rows.filter((r) => r.status === "RETURNED"),
    },
  };
}

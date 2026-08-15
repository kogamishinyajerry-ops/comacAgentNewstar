// 项目数据装载与权限判断(服务端复用)

import { prisma } from "./db";
import type { SessionUser } from "./auth";

export interface ProjectBundle {
  project: {
    id: string;
    title: string;
    track: string | null;
    status: string;
    currentStep: number;
    teamId: string;
    returnReason?: string | null;
    createdAt: Date;
    submittedAt: Date | null;
  };
  team: {
    id: string;
    name: string;
    mode: string;
    inviteCode: string;
    startTime: string | null;
    existingBase: string | null;
    addedDuringActivity: string | null;
    externalResources: string | null;
    helpers: string | null;
    memberCount: number;
  };
  members: { userId: string; name: string; email: string; seatRole: string }[];
  stages: { step: number; data: string }[];
  testCases: {
    id: string;
    name: string;
    type: string;
    input: string;
    expected: string;
    actual: string;
    verdict: string;
    manualFix: string;
    failureReason: string;
    sortOrder: number;
  }[];
}

export async function loadProjectBundle(projectId: string): Promise<ProjectBundle | null> {
  const project = await prisma.ideaProject.findUnique({
    where: { id: projectId },
    include: {
      team: { include: { members: { include: { user: true } } } },
      stages: true,
      testCases: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!project) return null;
  return {
    project: {
      id: project.id,
      title: project.title,
      track: project.track,
      status: project.status,
      currentStep: project.currentStep,
      teamId: project.teamId,
      returnReason: project.returnReason,
      createdAt: project.createdAt,
      submittedAt: project.submittedAt,
    },
    team: {
      id: project.team.id,
      name: project.team.name,
      mode: project.team.mode,
      inviteCode: project.team.inviteCode,
      startTime: project.team.startTime,
      existingBase: project.team.existingBase,
      addedDuringActivity: project.team.addedDuringActivity,
      externalResources: project.team.externalResources,
      helpers: project.team.helpers,
      memberCount: project.team.members.length,
    },
    members: project.team.members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      seatRole: m.seatRole,
    })),
    stages: project.stages.map((s) => ({ step: s.step, data: s.data })),
    testCases: project.testCases.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      input: t.input,
      expected: t.expected,
      actual: t.actual,
      verdict: t.verdict,
      manualFix: t.manualFix,
      failureReason: t.failureReason,
      sortOrder: t.sortOrder,
    })),
  };
}

/** 参与者:仅自己队伍的项目可操作 */
export function isProjectMember(user: SessionUser, bundle: ProjectBundle): boolean {
  return bundle.members.some((m) => m.userId === user.id);
}

/**
 * 查看权限:
 * - 参与者:仅限本队;
 * - 组织者:草稿只能看元数据与进度,不能看全文(页面层用 canViewFullContent 区分);
 * - 评委:仅被分配且作品已提交。
 */
export function canViewProject(user: SessionUser, bundle: ProjectBundle, assignmentJudgeIds?: string[]): boolean {
  if (user.role === "ORGANIZER" || user.role === "ADMIN") return true;
  if (isProjectMember(user, bundle)) return true;
  if (user.role === "JUDGE") {
    return bundle.project.status !== "DRAFT" && (assignmentJudgeIds?.includes(user.id) ?? false);
  }
  return false;
}

/** 组织者对未提交草稿只可见概要,不可见草稿全文 */
export function canViewFullContent(user: SessionUser, bundle: ProjectBundle): boolean {
  if (user.role === "ADMIN") return true;
  if (isProjectMember(user, bundle)) return true;
  if (user.role === "ORGANIZER") return bundle.project.status !== "DRAFT";
  return false;
}

/** 可编辑:成员 + 草稿/退回状态 */
export function canEditProject(user: SessionUser, bundle: ProjectBundle): boolean {
  return isProjectMember(user, bundle) && (bundle.project.status === "DRAFT" || bundle.project.status === "RETURNED");
}

export function precheckInputOf(bundle: ProjectBundle) {
  return {
    team: bundle.team,
    stages: bundle.stages,
    track: bundle.project.track,
    testCases: bundle.testCases,
  };
}

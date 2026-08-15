// API 路由共用:项目访问控制(编辑/查看权限)
import { apiUser, jsonError, type SessionUser } from "./auth";
import { canEditProject, canViewProject, loadProjectBundle, type ProjectBundle } from "./projects";
import { prisma } from "./db";

export async function judgeAssignmentIds(projectId: string): Promise<string[]> {
  const rows = await prisma.reviewAssignment.findMany({ where: { projectId }, select: { judgeId: true } });
  return rows.map((r) => r.judgeId);
}

type AccessResult =
  | { ok: true; user: SessionUser; bundle: ProjectBundle }
  | { ok: false; error: Response };

export async function projectAccess(projectId: string, mode: "edit" | "view"): Promise<AccessResult> {
  const user = await apiUser();
  if (!user) return { ok: false, error: jsonError(401, "请先登录") };
  const bundle = await loadProjectBundle(projectId);
  if (!bundle) return { ok: false, error: jsonError(404, "项目不存在") };
  if (mode === "edit") {
    if (!canEditProject(user, bundle)) return { ok: false, error: jsonError(403, "只有本队成员在草稿/退回状态下才能编辑") };
  } else {
    const judgeIds = user.role === "JUDGE" ? await judgeAssignmentIds(projectId) : undefined;
    if (!canViewProject(user, bundle, judgeIds)) return { ok: false, error: jsonError(403, "无权查看该项目") };
  }
  return { ok: true, user, bundle };
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

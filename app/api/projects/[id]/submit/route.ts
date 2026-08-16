import { prisma } from "@/lib/db";
import { audit, jsonError } from "@/lib/auth";
import { projectAccess } from "@/lib/api-helpers";
import { emitEvent } from "@/lib/events/bus";
import { runHardRules } from "@/lib/precheck";
import { precheckInputOf } from "@/lib/projects";
import { buildDemoScript, buildExperimentCard, buildVisibleResultChecklist } from "@/lib/deliverables";
import { validateTestCases } from "@/lib/validation";

/** 提交:硬规则全部通过才允许;创建不可变快照 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const { bundle, user } = access;
  if (bundle.project.status === "SUBMITTED" || bundle.project.status === "PRELIMINARY" || bundle.project.status === "FINAL") {
    return jsonError(409, "该项目已提交,请先撤回后再操作");
  }

  const precheckInput = precheckInputOf(bundle);
  const hardRules = runHardRules(precheckInput);
  if (!hardRules.canSubmit) {
    return Response.json(
      { ok: false, error: "硬条件未满足,无法提交", blocking: hardRules.blocking },
      { status: 422 }
    );
  }

  const lastSnapshot = await prisma.submissionSnapshot.findFirst({
    where: { projectId: params.id },
    orderBy: { version: "desc" },
  });
  const version = (lastSnapshot?.version ?? 0) + 1;

  const deliverableInput = {
    ...precheckInput,
    title: bundle.project.title,
    teamName: bundle.team.name,
    memberNames: bundle.members.map((m) => m.name),
  };
  const payload = {
    project: { id: bundle.project.id, title: bundle.project.title, track: bundle.project.track },
    team: bundle.team,
    members: bundle.members,
    stages: bundle.stages,
    testCases: bundle.testCases,
    testSummary: validateTestCases(bundle.testCases),
    hardRules,
    experimentCard: buildExperimentCard(deliverableInput),
    visibleResultChecklist: buildVisibleResultChecklist(),
    demoScript: buildDemoScript(deliverableInput),
    submittedAt: new Date().toISOString(),
  };

  await prisma.$transaction([
    prisma.submissionSnapshot.create({
      data: { projectId: params.id, version, payload: JSON.stringify(payload) },
    }),
    prisma.ideaProject.update({
      where: { id: params.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), returnReason: null },
    }),
  ]);
  await audit(user, "project.submit", "IdeaProject", params.id, `v${version}`);
  await emitEvent({
    type: "project.submitted",
    payload: { projectId: params.id, title: bundle.project.title, version, team: bundle.team.name },
    actor: user,
    projectId: params.id,
  });
  return Response.json({ ok: true, version });
}

/** 撤回:回到草稿,快照保留作历史版本 */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "view");
  if (!access.ok) return access.error;
  const { bundle, user } = access;
  const member = bundle.members.some((m) => m.userId === user.id);
  if (!member && user.role !== "ADMIN") return jsonError(403, "只有本队成员可以撤回");
  if (!["SUBMITTED", "RETURNED"].includes(bundle.project.status)) {
    return jsonError(409, "当前状态不支持撤回");
  }
  await prisma.ideaProject.update({ where: { id: params.id }, data: { status: "DRAFT" } });
  await audit(user, "project.withdraw", "IdeaProject", params.id, `from ${bundle.project.status}`);
  await emitEvent({
    type: "project.status_changed",
    payload: { projectId: params.id, title: bundle.project.title, from: bundle.project.status, to: "DRAFT", reason: "队内撤回" },
    actor: user,
    projectId: params.id,
  });
  return Response.json({ ok: true });
}

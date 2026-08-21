import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEditProject, canViewProject, isProjectMember, loadProjectBundle } from "@/lib/projects";
import { judgeAssignmentIds } from "@/lib/api-helpers";
import { getStageData } from "@/lib/validation";
import { AdvancedWizard } from "@/components/agent-collaboration/advanced-wizard";
import { DecisionWorkspace } from "@/components/agent-collaboration/decision-workspace";
import type { WizardData } from "@/components/wizard-types";

export default async function ProjectWizardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { step?: string; view?: string };
}) {
  const user = await requireUser();
  const bundle = await loadProjectBundle(params.id);
  if (!bundle) notFound();

  const judgeIds = user.role === "JUDGE" ? await judgeAssignmentIds(params.id) : undefined;
  if (!canViewProject(user, bundle, judgeIds)) notFound();
  const isMember = isProjectMember(user, bundle);
  const editable = canEditProject(user, bundle);
  // 组织者可以查看已提交作品,但草稿全文仅本队可见
  if (!isMember && user.role !== "ADMIN" && bundle.project.status === "DRAFT" && user.role === "ORGANIZER") {
    redirect("/organizer/projects");
  }

  const stages: Record<number, Record<string, unknown>> = {};
  for (const s of bundle.stages) stages[s.step] = getStageData(bundle.stages, s.step);

  const feedbackRows = isMember
    ? await prisma.agentFeedback.findMany({
        where: { projectId: params.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          session: {
            select: {
              purpose: true,
              provider: true,
              model: true,
              promptVersionLabel: true,
              status: true,
              latencyMs: true,
              createdAt: true,
            },
          },
        },
      })
    : [];
  const snapshots = await prisma.submissionSnapshot.findMany({
    where: { projectId: params.id },
    orderBy: { version: "desc" },
  });
  const attachments = await prisma.attachment.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });

  const data: WizardData = {
    projectId: bundle.project.id,
    title: bundle.project.title,
    track: bundle.project.track,
    status: bundle.project.status,
    currentStep: Math.min(10, Math.max(1, Number(searchParams.step) || bundle.project.currentStep || 1)),
    returnReason: bundle.project.returnReason ?? null,
    readOnly: !editable,
    isMember,
    team: {
      id: bundle.team.id,
      name: bundle.team.name,
      mode: bundle.team.mode,
      inviteCode: bundle.team.inviteCode,
      startTime: bundle.team.startTime,
      existingBase: bundle.team.existingBase,
      addedDuringActivity: bundle.team.addedDuringActivity,
      externalResources: bundle.team.externalResources,
      helpers: bundle.team.helpers,
      members: bundle.members.map((m) => ({ name: m.name, seatRole: m.seatRole })),
    },
    stages,
    testCases: bundle.testCases.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type as WizardData["testCases"][number]["type"],
      input: t.input,
      expected: t.expected,
      actual: t.actual,
      verdict: t.verdict as WizardData["testCases"][number]["verdict"],
      manualFix: t.manualFix,
      failureReason: t.failureReason,
    })),
    feedbacks: feedbackRows.map((f) => ({
      id: f.id,
      step: f.step,
      purpose: f.session.purpose,
      content: JSON.parse(f.content),
      suggestionStates: JSON.parse(f.suggestionStates || "{}"),
      answers: JSON.parse(f.answers || "{}"),
      createdAt: f.createdAt.toISOString(),
      run: {
        feedbackId: f.id,
        provider: f.session.provider,
        model: f.session.model,
        promptVersionLabel: f.session.promptVersionLabel,
        status: f.session.status,
        latencyMs: f.session.latencyMs,
        createdAt: f.session.createdAt.toISOString(),
      },
    })),
    snapshots: snapshots.map((s) => ({ version: s.version, createdAt: s.createdAt.toISOString() })),
    attachments: attachments.map((a) => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      url: a.kind === "FILE" ? `/api/attachments/${a.id}/download` : a.url,
      sizeKb: a.sizeKb,
    })),
  };

  if (searchParams.view === "advanced") return <AdvancedWizard data={data} />;

  return <DecisionWorkspace data={data} actorName={user.name} actorRole={user.role} />;
}

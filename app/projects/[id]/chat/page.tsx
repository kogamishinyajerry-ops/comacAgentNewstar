import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canEditProject, canViewProject, isProjectMember, loadProjectBundle } from "@/lib/projects";
import { judgeAssignmentIds } from "@/lib/api-helpers";
import { computeProjectProgress } from "@/lib/progress";
import { chatHistory } from "@/lib/llm/chat";
import { ChatRunner } from "@/components/chat-runner";

export default async function ProjectChatPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const bundle = await loadProjectBundle(params.id);
  if (!bundle) notFound();
  const judgeIds = user.role === "JUDGE" ? await judgeAssignmentIds(params.id) : undefined;
  if (!canViewProject(user, bundle, judgeIds)) notFound();

  const editable = canEditProject(user, bundle);
  const [feedbackCount, snapshotCount, messages] = await Promise.all([
    prisma.agentFeedback.count({ where: { projectId: params.id } }),
    prisma.submissionSnapshot.count({ where: { projectId: params.id } }),
    isProjectMember(user, bundle) ? chatHistory(params.id) : Promise.resolve([]),
  ]);

  const progress = computeProjectProgress(bundle, {
    feedbackCount,
    hasSnapshot: snapshotCount > 0,
  });

  return (
    <ChatRunner
      boot={{
        projectId: bundle.project.id,
        title: bundle.project.title,
        status: bundle.project.status,
        readOnly: !editable,
        progress: {
          overallPct: progress.overallPct,
          closedLoopOk: progress.closedLoopOk,
          tests: { count: progress.tests.count, passOk: progress.tests.passOk, coverageOk: progress.tests.coverageOk },
          nextHint: progress.nextHint,
          currentStep: progress.currentStep,
        },
      }}
      initialMessages={messages}
    />
  );
}

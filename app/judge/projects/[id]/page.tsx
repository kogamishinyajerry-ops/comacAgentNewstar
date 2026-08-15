import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { ReviewForm } from "./review-form";
import { RecuseButton } from "./recuse-button";

export default async function JudgeProjectPage({ params }: { params: { id: string } }) {
  const user = await requireRole("JUDGE", "ADMIN");

  const assignment = await prisma.reviewAssignment.findFirst({
    where: { projectId: params.id, judgeId: user.id },
    include: {
      review: true,
      project: { include: { team: { include: { members: { include: { user: true } } } }, snapshots: { orderBy: { version: "desc" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!assignment) notFound();
  if (assignment.status === "RECUSED") notFound();

  const snapshot = assignment.project.snapshots[0];
  if (!snapshot) notFound();
  const payload = JSON.parse(snapshot.payload);
  const card = payload.experimentCard as {
    header: { title: string; track: string; team: string; members: string };
    sections: { heading: string; rows: { label: string; value: string }[] }[];
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">评审:{assignment.project.title}</h1>
        <Link href="/judge" className="text-sm text-brand-600 hover:underline">← 返回工作台</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={`提交快照 v${snapshot.version} · ${new Date(snapshot.createdAt).toLocaleString("zh-CN")}`}>
          <p className="mb-3 text-xs text-slate-500">
            评审基于不可变提交快照;{card.header.track} · {card.header.team} · {card.header.members}
          </p>
          <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
            {card.sections.map((sec) => (
              <section key={sec.heading}>
                <h2 className="mb-1.5 border-l-4 border-brand-600 pl-2 text-sm font-semibold">{sec.heading}</h2>
                <dl className="space-y-1">
                  {sec.rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                      <dt className="shrink-0 font-medium text-slate-500">{r.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <p className="mt-3">
            <a href={`/projects/${params.id}/card?version=${snapshot.version}`} target="_blank" className="text-xs text-brand-600 hover:underline">
              打开完整小实验卡与90秒Demo脚本 →
            </a>
          </p>
        </Card>

        <div className="space-y-3">
          <ReviewForm
            assignmentId={assignment.id}
            locked={assignment.review?.status === "LOCKED"}
            initial={{
              problemDefinition: assignment.review?.problemDefinition ?? 5,
              originality: assignment.review?.originality ?? 5,
              closedLoop: assignment.review?.closedLoop ?? 5,
              evidence: assignment.review?.evidence ?? 5,
              bestValue: assignment.review?.bestValue ?? "",
              topImprovement: assignment.review?.topImprovement ?? "",
            }}
          />
          <Card title="回避">
            <p className="text-xs text-slate-500">与该作品存在利益关联时应回避;回避后不可恢复。</p>
            <RecuseButton assignmentId={assignment.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

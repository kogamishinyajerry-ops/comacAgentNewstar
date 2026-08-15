import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { AssignForm } from "./assign-form";
import { UnassignButton } from "./unassign-button";

export default async function OrganizerReviewsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const [projects, judges, assignments] = await Promise.all([
    prisma.ideaProject.findMany({
      where: { status: { in: ["SUBMITTED", "PRELIMINARY", "FINAL"] } },
      include: { team: { include: { members: { include: { user: true } } } } },
      orderBy: { submittedAt: "desc" },
    }),
    prisma.user.findMany({ where: { role: "JUDGE" }, orderBy: { name: "asc" } }),
    prisma.reviewAssignment.findMany({
      include: {
        judge: true,
        project: { select: { title: true } },
        review: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">评审分配</h1>
        <a href="/api/organizer/export?type=scores" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">导出评分CSV</a>
      </div>

      <Card title="新建分配">
        <AssignForm
          projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
          judges={judges.map((j) => ({ id: j.id, name: j.name }))}
        />
        {projects.length === 0 && <p className="mt-2 text-xs text-slate-400">当前没有已提交的作品可分配。</p>}
      </Card>

      <Card title={`分配列表(${assignments.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">作品</th>
                <th className="py-2 pr-3">评委</th>
                <th className="py-2 pr-3">轮次</th>
                <th className="py-2 pr-3">评分状态</th>
                <th className="py-2 pr-3">四维/总分</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const r = a.review;
                const total = r ? r.problemDefinition + r.originality + r.closedLoop + r.evidence : null;
                return (
                  <tr key={a.id} className="border-b border-slate-50">
                    <td className="py-2.5 pr-3 font-medium text-slate-700">{a.project.title}</td>
                    <td className="py-2.5 pr-3">{a.judge.name}</td>
                    <td className="py-2.5 pr-3 text-xs">{a.round === "PRELIMINARY" ? "预赛" : "决赛"}</td>
                    <td className="py-2.5 pr-3">
                      {a.status === "RECUSED" ? (
                        <Badge tone="amber">已回避</Badge>
                      ) : r?.status === "LOCKED" ? (
                        <Badge tone="green">已锁定</Badge>
                      ) : r ? (
                        <Badge tone="blue">草稿</Badge>
                      ) : (
                        <Badge tone="gray">未开始</Badge>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      {r ? `${r.problemDefinition}/${r.originality}/${r.closedLoop}/${r.evidence} = ${total}` : "—"}
                    </td>
                    <td className="py-2.5">
                      {r?.status !== "LOCKED" && <UnassignButton id={a.id} />}
                    </td>
                  </tr>
                );
              })}
              {assignments.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-sm text-slate-400">暂无分配</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

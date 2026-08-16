import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui";
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
    <div className="space-y-4 py-2">
      <PageHeader
        title="评审分配"
        desc="把已提交作品分配给评委(预赛/决赛);锁定评分不可取消分配。"
        actions={
          <a href="/api/organizer/export?type=scores" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50">导出评分CSV</a>
        }
      />

      <Card title="新建分配">
        <AssignForm
          projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
          judges={judges.map((j) => ({ id: j.id, name: j.name }))}
        />
        {projects.length === 0 && <p className="mt-2 text-xs text-slate-400">当前没有已提交的作品可分配。</p>}
      </Card>

      <Card title={`分配列表 · ${assignments.length}`} bodyClassName="px-4 py-1">
        <Table>
          <thead>
            <tr>
              <Th>作品</Th>
              <Th>评委</Th>
              <Th>轮次</Th>
              <Th>评分状态</Th>
              <Th>四维/总分</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const r = a.review;
              const total = r ? r.problemDefinition + r.originality + r.closedLoop + r.evidence : null;
              return (
                <tr key={a.id} className="transition-colors hover:bg-slate-50/70">
                  <Td className="font-medium text-slate-800">{a.project.title}</Td>
                  <Td>{a.judge.name}</Td>
                  <Td className="text-xs">{a.round === "PRELIMINARY" ? "预赛" : "决赛"}</Td>
                  <Td>
                    {a.status === "RECUSED" ? (
                      <Badge tone="amber">已回避</Badge>
                    ) : r?.status === "LOCKED" ? (
                      <Badge tone="green">已锁定</Badge>
                    ) : r ? (
                      <Badge tone="blue">草稿</Badge>
                    ) : (
                      <Badge tone="slate">未开始</Badge>
                    )}
                  </Td>
                  <Td className="tnum text-xs">
                    {r ? `${r.problemDefinition}/${r.originality}/${r.closedLoop}/${r.evidence} = ${total}` : "—"}
                  </Td>
                  <Td>
                    {r?.status !== "LOCKED" && <UnassignButton id={a.id} />}
                  </Td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr><Td colSpan={6} className="py-8 text-center text-slate-400">暂无分配</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

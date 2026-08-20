import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, Table, Td, Th } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { AssignForm } from "./assign-form";
import { UnassignButton } from "./unassign-button";
import { ExportLink } from "../export-link";

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
    <div className="space-y-5 py-2">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker">Review Assignment</p>
            <h1 className="font-display mt-2 text-display-lg text-ink-900">评审分配</h1>
            <p className="mt-2 max-w-2xl text-caption text-ink-500">
              把已提交作品分配给评委(预赛/决赛);锁定评分不可取消分配。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ExportLink href="/api/organizer/export?type=scores" label="导出评分CSV" />
          </div>
        </header>
      </Reveal>

      <Reveal delayMs={70}>
        <Card title="新建分配">
          <AssignForm
            projects={projects.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
            judges={judges.map((j) => ({ id: j.id, name: j.name }))}
          />
          {projects.length === 0 && <p className="mt-2 text-xs text-ink-500">当前没有已提交的作品可分配。</p>}
        </Card>
      </Reveal>

      <Card title={`分配列表 · ${assignments.length}`} bodyClassName="px-4 py-1">
        <Table>
          <thead>
            <tr>
              <Th className="min-w-44">作品</Th>
              <Th className="min-w-24">评委</Th>
              <Th className="min-w-16">轮次</Th>
              <Th className="min-w-20">评分状态</Th>
              <Th className="min-w-32">四维/总分</Th>
              <Th className="min-w-24">操作</Th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const r = a.review;
              const total = r ? r.problemDefinition + r.originality + r.closedLoop + r.evidence : null;
              return (
                <tr key={a.id} className="transition-colors hover:bg-ink-50/60">
                  <Td className="font-medium text-ink-800">{a.project.title}</Td>
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
                    {r?.status !== "LOCKED" && <UnassignButton id={a.id} projectTitle={a.project.title} judgeName={a.judge.name} />}
                  </Td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr><Td colSpan={6} className="py-8 text-center text-ink-500">暂无分配</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

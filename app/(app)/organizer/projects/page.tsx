import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, PageHeader, StatusBadge, Table, Td, Th } from "@/components/ui";
import { TRACKS } from "@/lib/constants";
import { OrganizerProjectActions } from "./project-actions";

export default async function OrganizerProjectsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const projects = await prisma.ideaProject.findMany({
    include: { team: { include: { members: { include: { user: true } } } }, testCases: { select: { verdict: true, type: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4 py-2">
      <PageHeader
        title="作品与状态管理"
        desc="状态流转(退回/预赛/决赛/归档)与进度概览;草稿全文仅本队可见。"
        actions={
          <a href="/api/organizer/export?type=projects" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50">导出CSV</a>
        }
      />

      <Card title={`全部作品 · ${projects.length}`} bodyClassName="px-4 py-1">
        <Table>
          <thead>
            <tr>
              <Th className="w-44">作品</Th>
              <Th>队伍/成员</Th>
              <Th>赛道</Th>
              <Th>状态</Th>
              <Th>进度</Th>
              <Th>测试</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const track = TRACKS.find((t) => t.key === p.track);
              const pass = p.testCases.filter((t) => t.verdict === "PASS").length;
              const hasFailure = p.testCases.some((t) => t.type === "FAILURE" || t.type === "NA");
              return (
                <tr key={p.id} className="transition-colors hover:bg-slate-50/70">
                  <Td>
                    <Link href={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-brand-600">{p.title}</Link>
                    {p.returnReason && <p className="mt-0.5 text-[11px] text-amber-700">退回:{p.returnReason}</p>}
                  </Td>
                  <Td className="text-xs text-slate-600">
                    {p.team.name}
                    <br />
                    <span className="text-slate-400">{p.team.members.map((m) => m.user.name).join("、")}</span>
                  </Td>
                  <Td className="text-xs">{track?.name ?? "—"}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="tnum text-xs">第{p.currentStep}步</Td>
                  <Td className="text-xs">
                    <span className="tnum">{p.testCases.length}例/通过{pass}</span>
                    {hasFailure && <Badge tone="green">含失败例</Badge>}
                  </Td>
                  <Td>
                    <OrganizerProjectActions projectId={p.id} status={p.status} />
                  </Td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr><Td colSpan={7} className="py-8 text-center text-slate-400">暂无作品</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

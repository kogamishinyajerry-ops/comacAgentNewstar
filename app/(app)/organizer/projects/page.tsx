import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, StatusBadge, Table, Td, Th } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { TRACKS } from "@/lib/constants";
import { OrganizerProjectActions } from "./project-actions";
import { ExportLink } from "../export-link";

export default async function OrganizerProjectsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const projects = await prisma.ideaProject.findMany({
    include: { team: { include: { members: { include: { user: true } } } }, testCases: { select: { verdict: true, type: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-5 py-2">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker">Submissions</p>
            <h1 className="font-display mt-2 text-display-lg text-ink-900">作品与状态管理</h1>
            <p className="mt-2 max-w-2xl text-caption text-ink-500">
              状态流转(退回/预赛/决赛/归档)与进度概览;草稿全文仅本队可见。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ExportLink href="/api/organizer/export?type=projects" label="导出CSV" />
          </div>
        </header>
      </Reveal>

      <Card title={`全部作品 · ${projects.length}`} bodyClassName="px-4 py-1">
        <Table>
          <thead>
            <tr>
              <Th className="w-44">作品</Th>
              <Th className="min-w-32">队伍/成员</Th>
              <Th className="min-w-24">赛道</Th>
              <Th className="min-w-20">状态</Th>
              <Th className="min-w-16">进度</Th>
              <Th className="min-w-28">测试</Th>
              <Th className="min-w-32">操作</Th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const track = TRACKS.find((t) => t.key === p.track);
              const pass = p.testCases.filter((t) => t.verdict === "PASS").length;
              const hasFailure = p.testCases.some((t) => t.type === "FAILURE" || t.type === "NA");
              return (
                <tr key={p.id} className="transition-colors hover:bg-ink-50/60">
                  <Td>
                    <Link href={`/projects/${p.id}`} className="font-medium text-ink-800 transition-colors hover:text-brand-600">{p.title}</Link>
                    {p.returnReason && <p className="mt-0.5 text-[11px] text-amber-700">退回:{p.returnReason}</p>}
                  </Td>
                  <Td className="text-xs text-ink-600">
                    {p.team.name}
                    <br />
                    <span className="text-ink-500">{p.team.members.map((m) => m.user.name).join("、")}</span>
                  </Td>
                  <Td className="text-xs">{track?.name ?? "—"}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="tnum text-xs">第{p.currentStep}步</Td>
                  <Td className="text-xs">
                    <span className="tnum">{p.testCases.length}例/通过{pass}</span>
                    {hasFailure && <Badge tone="amber">含失败例</Badge>}
                  </Td>
                  <Td>
                    <OrganizerProjectActions projectId={p.id} status={p.status} title={p.title} />
                  </Td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr><Td colSpan={7} className="py-8 text-center text-ink-500">暂无作品</Td></tr>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

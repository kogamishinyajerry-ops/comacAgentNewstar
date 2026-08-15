import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, StatusBadge } from "@/components/ui";
import { TRACKS } from "@/lib/constants";
import { OrganizerProjectActions } from "./project-actions";

export default async function OrganizerProjectsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const projects = await prisma.ideaProject.findMany({
    include: { team: { include: { members: { include: { user: true } } } }, testCases: { select: { verdict: true, type: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">作品与状态管理</h1>
        <a href="/api/organizer/export?type=projects" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">导出CSV</a>
      </div>

      <Card title={`全部作品(${projects.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">作品</th>
                <th className="py-2 pr-3">队伍/成员</th>
                <th className="py-2 pr-3">赛道</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3">进度</th>
                <th className="py-2 pr-3">测试</th>
                <th className="py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const track = TRACKS.find((t) => t.key === p.track);
                const pass = p.testCases.filter((t) => t.verdict === "PASS").length;
                const hasFailure = p.testCases.some((t) => t.type === "FAILURE" || t.type === "NA");
                return (
                  <tr key={p.id} className="border-b border-slate-50 align-top">
                    <td className="py-2.5 pr-3">
                      <Link href={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-brand-600">{p.title}</Link>
                      {p.returnReason && <p className="mt-0.5 text-xs text-amber-700">退回:{p.returnReason}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">
                      {p.team.name}
                      <br />
                      {p.team.members.map((m) => m.user.name).join("、")}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{track?.name ?? "—"}</td>
                    <td className="py-2.5 pr-3"><StatusBadge status={p.status} /></td>
                    <td className="py-2.5 pr-3 text-xs">第{p.currentStep}步</td>
                    <td className="py-2.5 pr-3 text-xs">
                      {p.testCases.length}例/通过{pass}
                      {hasFailure && <Badge tone="green">含失败例</Badge>}
                    </td>
                    <td className="py-2.5">
                      <OrganizerProjectActions projectId={p.id} status={p.status} />
                    </td>
                  </tr>
                );
              })}
              {projects.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-400">暂无作品</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          组织者默认不查看参与者未提交的草稿全文;点击草稿作品仅能看到进度概要。提交后的作品与快照可完整查看。
        </p>
      </Card>
    </div>
  );
}

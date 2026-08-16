import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, LinkButton, PageHeader, StatCard, Card } from "@/components/ui";
import { RISK_LABELS, STATUS_LABELS, type ProjectStatus, type RiskType } from "@/lib/constants";
import { isMockEnabled } from "@/lib/llm/provider";

export default async function OrganizerDashboard() {
  await requireRole("ORGANIZER", "ADMIN");

  const [projects, teams, users, sessions, tokenUsage, audits] = await Promise.all([
    prisma.ideaProject.findMany({ include: { team: { include: { members: true } }, testCases: { select: { verdict: true } } } }),
    prisma.team.findMany({ include: { members: true } }),
    prisma.user.findMany(),
    prisma.agentSession.findMany({ select: { status: true, provider: true, latencyMs: true } }),
    prisma.tokenUsage.aggregate({ _sum: { totalTokens: true, promptTokens: true, completionTokens: true }, _count: true }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);

  const byStatus = (s: ProjectStatus) => projects.filter((p) => p.status === s).length;

  // 汇总各项目最新一次Agent反馈中的风险标记
  const latestFeedbacks = await prisma.agentFeedback.findMany({
    orderBy: { createdAt: "desc" },
    include: { project: { select: { title: true, id: true } } },
  });
  const seenProjects = new Set<string>();
  const riskRows: { project: string; type: string; severity: string; message: string }[] = [];
  for (const f of latestFeedbacks) {
    if (seenProjects.has(f.projectId)) continue;
    seenProjects.add(f.projectId);
    try {
      const content = JSON.parse(f.content) as { risk_flags?: { type: string; severity: string; message: string }[] };
      for (const r of content.risk_flags ?? []) {
        riskRows.push({ project: f.project.title, type: r.type, severity: r.severity, message: r.message });
      }
    } catch {
      /* ignore */
    }
  }
  const highRisks = riskRows.filter((r) => r.severity === "high");
  const okSessions = sessions.filter((s) => s.status === "OK").length;
  const avgLatency = sessions.length ? Math.round(sessions.reduce((a, s) => a + s.latencyMs, 0) / sessions.length) : 0;

  const stats = [
    { label: "作品总数", value: projects.length, tone: "default" as const },
    { label: "队伍", value: teams.length, tone: "default" as const },
    { label: "参与者", value: users.filter((u) => u.role === "PARTICIPANT").length, tone: "default" as const },
    { label: "已提交", value: byStatus("SUBMITTED") + byStatus("PRELIMINARY") + byStatus("FINAL"), tone: "brand" as const },
    { label: "退回补充", value: byStatus("RETURNED"), tone: byStatus("RETURNED") ? "danger" as const : "default" as const },
    { label: "高风险标记", value: highRisks.length, tone: highRisks.length ? "danger" as const : "success" as const },
  ];

  return (
    <div className="space-y-5 py-2">
      <PageHeader
        title="组织者仪表盘"
        desc="活动整体健康度:提交进度、风险聚合、Agent调用与审计。"
        actions={
          <>
            <LinkButton href="/organizer/progress">进展中枢</LinkButton>
            <LinkButton href="/organizer/projects" variant="secondary" size="sm">作品与状态</LinkButton>
            <LinkButton href="/organizer/reviews" variant="secondary" size="sm">评审分配</LinkButton>
            <LinkButton href="/organizer/config" variant="secondary" size="sm">活动配置</LinkButton>
            <a href="/api/organizer/export?type=projects" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50">导出名单</a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`风险汇总(取各作品最新诊断,共${riskRows.length}条)`}>
          {riskRows.length === 0 ? (
            <p className="text-sm text-slate-400">暂无风险标记。</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-auto text-xs">
              {riskRows.slice(0, 20).map((r, i) => (
                <li key={i} className="flex items-start gap-2 rounded border border-slate-100 p-2">
                  <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "gray"}>
                    {RISK_LABELS[r.type as RiskType] ?? r.type}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.project}</span>
                    <span className="text-slate-500">:{r.message}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Agent 调用统计">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded border border-slate-100 p-2">
              <dt className="text-xs text-slate-500">调用总数</dt>
              <dd className="text-lg font-semibold">{sessions.length}</dd>
            </div>
            <div className="rounded border border-slate-100 p-2">
              <dt className="text-xs text-slate-500">成功率(OK)</dt>
              <dd className="text-lg font-semibold">{sessions.length ? Math.round((okSessions / sessions.length) * 100) : 0}%</dd>
            </div>
            <div className="rounded border border-slate-100 p-2">
              <dt className="text-xs text-slate-500">平均延迟</dt>
              <dd className="text-lg font-semibold">{avgLatency}ms</dd>
            </div>
            <div className="rounded border border-slate-100 p-2">
              <dt className="text-xs text-slate-500">Token累计</dt>
              <dd className="text-lg font-semibold">{tokenUsage._sum.totalTokens ?? 0}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-400">
            当前Provider:{isMockEnabled() ? "Mock(无GLM_API_KEY或开启LLM_MOCK_MODE)" : "GLM"}
            {sessions.length > 0 && ` · 修复/降级/错误:${sessions.filter((s) => s.status !== "OK").length}次`}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="作品进度概览">
          <ul className="max-h-72 space-y-1.5 overflow-auto text-sm">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1.5">
                <Link href={`/organizer/projects`} className="font-medium text-slate-700 hover:text-brand-600">
                  {p.title}
                </Link>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone="gray">{STATUS_LABELS[p.status as ProjectStatus]}</Badge>
                  <span>第{p.currentStep}步</span>
                  <span>{p.team.members.length}人</span>
                  <span>{p.testCases.length}测试</span>
                </span>
              </li>
            ))}
            {projects.length === 0 && <li className="text-sm text-slate-400">暂无作品。</li>}
          </ul>
        </Card>

        <Card title="最近审计日志">
          <ul className="max-h-72 space-y-1 overflow-auto text-xs">
            {audits.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-b border-slate-50 py-1">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-slate-700">{a.actorName}</span>
                  <span className="text-slate-500"> {a.action} </span>
                  <span className="text-slate-400">{a.targetType}</span>
                </span>
                <span className="shrink-0 text-slate-400">{new Date(a.createdAt).toLocaleString("zh-CN")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

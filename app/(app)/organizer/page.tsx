import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, LinkButton, StatCard, Card } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { RISK_LABELS, STATUS_LABELS, type ProjectStatus, type RiskType } from "@/lib/constants";
import { isMockEnabled } from "@/lib/llm/provider";
import { ExportLink } from "./export-link";

/* 审计日志 action key → 中文动作;未知 key 原样透出,不伪造语义 */
const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.login": "登录",
  "user.logout": "退出登录",
  "user.register": "注册账号",
  "team.create": "创建队伍",
  "team.update": "更新队伍",
  "team.join": "加入队伍",
  "project.create": "创建作品",
  "project.track": "选择赛道",
  "project.submit": "提交作品",
  "project.withdraw": "撤回提交",
  "project.return": "退回作品",
  "project.preliminary": "晋级预赛",
  "project.final": "晋级决赛",
  "project.archive": "归档作品",
  "attachment.link.add": "添加链接附件",
  "attachment.file.add": "上传文件附件",
  "attachment.delete": "删除附件",
  "notice.nudge": "发送催办",
  "config.activity.update": "更新活动配置",
  "config.track.update": "更新赛道配置",
  "review.assign": "分配评审",
  "review.unassign": "取消评审分配",
  "review.recuse": "回避评审",
  "review.lock": "锁定评分",
  "export.projects": "导出名单",
  "export.scores": "导出评分",
  "content.announcement.create": "发布公告",
  "content.inspiration.create": "发布灵感案例",
  "content.officehour.create": "发布答疑安排",
  "prompt.activate": "启用提示词版本",
  "art.generate": "生成视觉素材",
  "workbuddy.chat": "工作台对话",
  "agent.answer": "回答Agent追问",
  "agent.suggestion_state": "处理Agent建议",
  "confirmation.execute": "执行待确认操作",
  "confirmation.deny": "拒绝待确认操作",
  "confirmation.expire": "待确认操作过期",
};

const AUDIT_TARGET_LABELS: Record<string, string> = {
  User: "用户",
  Team: "队伍",
  IdeaProject: "作品",
  Attachment: "附件",
  Review: "评分",
  ReviewAssignment: "评审分配",
  ActivityConfig: "活动配置",
  TrackConfig: "赛道配置",
  AgentFeedback: "Agent反馈",
  Announcement: "公告",
  InspirationCase: "灵感案例",
  OfficeHour: "答疑安排",
  PromptVersion: "提示词版本",
  PendingAction: "待确认操作",
  ActivityControl: "活动控制",
  ArtAsset: "视觉素材",
  System: "系统",
};

function auditActionLabel(action: string): string {
  if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
  if (action.startsWith("content.") && action.endsWith(".delete")) return "删除内容";
  if (action.startsWith("action.")) return action.endsWith(".pending") ? "发起待确认操作" : "执行控制台操作";
  return action;
}

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
    { label: "已提交", value: byStatus("SUBMITTED") + byStatus("PRELIMINARY") + byStatus("FINAL"), tone: "default" as const },
    { label: "退回补充", value: byStatus("RETURNED"), tone: byStatus("RETURNED") ? "danger" as const : "default" as const },
    { label: "高风险标记", value: highRisks.length, tone: highRisks.length ? "danger" as const : "success" as const },
  ];

  const agentStats: { label: string; value: string; unit?: string }[] = [
    { label: "调用总数", value: sessions.length.toLocaleString("zh-CN") },
    { label: "成功率(OK)", value: `${sessions.length ? Math.round((okSessions / sessions.length) * 100) : 0}`, unit: "%" },
    { label: "平均延迟", value: avgLatency.toLocaleString("zh-CN"), unit: "ms" },
    { label: "Token累计", value: (tokenUsage._sum.totalTokens ?? 0).toLocaleString("zh-CN") },
  ];

  return (
    <div className="space-y-6 py-2">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker">Organizer Console</p>
            <h1 className="font-display mt-2 text-display-lg text-ink-900">组织者仪表盘</h1>
            <p className="mt-2 max-w-2xl text-caption text-ink-500">
              活动整体健康度:提交进度、风险聚合、Agent调用与审计。
            </p>
          </div>
          <nav className="flex min-w-0 max-w-full flex-wrap items-center gap-2" aria-label="组织者工作区导航">
            <LinkButton href="/organizer/progress" size="sm">进展中枢</LinkButton>
            <LinkButton href="/organizer/projects" variant="secondary" size="sm">作品与状态</LinkButton>
            <LinkButton href="/organizer/reviews" variant="secondary" size="sm">评审分配</LinkButton>
            <LinkButton href="/organizer/config" variant="secondary" size="sm">活动配置</LinkButton>
            <ExportLink href="/api/organizer/export?type=projects" label="导出名单" />
          </nav>
        </header>
      </Reveal>

      <Reveal delayMs={70}>
        <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-6">
          {stats.map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      </Reveal>

      <Reveal delayMs={140}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={`风险汇总(取各作品最新诊断,共${riskRows.length}条)`}>
            {riskRows.length === 0 ? (
              <p className="flex items-center gap-2 py-1 text-[13px] text-ink-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/80" aria-hidden>
                  <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="#0f7564" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m2.5 6.2 2.4 2.4 4.6-5.4" />
                  </svg>
                </span>
                暂无风险标记。
              </p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-auto text-xs">
                {riskRows.slice(0, 20).map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-ink-900/10 bg-[#fffdf8] p-2 transition-colors duration-150 hover:border-ink-900/20"
                  >
                    <Badge tone={r.severity === "high" ? "red" : r.severity === "medium" ? "amber" : "gray"}>
                      {RISK_LABELS[r.type as RiskType] ?? r.type}
                    </Badge>
                    <span className="min-w-0 flex-1 leading-5">
                      <span className="font-medium text-ink-800">{r.project}</span>
                      <span className="text-ink-500">:{r.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Agent 调用统计">
            <dl className="grid grid-cols-2 gap-2.5">
              {agentStats.map((s) => (
                <div key={s.label} className="rounded-md border border-ink-900/10 bg-ink-50/50 px-3 py-2.5">
                  <dt className="text-[11px] font-medium tracking-wide text-ink-500">{s.label}</dt>
                  <dd className="tnum mt-1 text-xl font-semibold tracking-tight text-ink-900">
                    {s.value}
                    {s.unit && <span className="ml-0.5 text-xs font-normal text-ink-500">{s.unit}</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-ink-900/10 pt-2.5 text-xs leading-5 text-ink-500">
              当前Provider:{isMockEnabled() ? "Mock(无GLM_API_KEY或开启LLM_MOCK_MODE)" : "GLM"}
              {sessions.length > 0 && ` · 修复/降级/错误:${sessions.filter((s) => s.status !== "OK").length}次`}
            </p>
          </Card>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="作品进度概览">
          <ul className="max-h-72 space-y-1.5 overflow-auto text-sm">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border border-ink-900/10 px-2.5 py-1.5 transition-colors duration-150 hover:border-ink-900/20 hover:bg-ink-50/40"
              >
                <Link href={`/organizer/projects`} className="truncate font-medium text-ink-800 transition-colors hover:text-brand-600">
                  {p.title}
                </Link>
                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-500">
                  <Badge tone="gray">{STATUS_LABELS[p.status as ProjectStatus]}</Badge>
                  <span className="tnum">第{p.currentStep}步</span>
                  <span className="tnum">{p.team.members.length}人</span>
                  <span className="tnum">{p.testCases.length}测试</span>
                </span>
              </li>
            ))}
            {projects.length === 0 && <li className="text-sm text-ink-500">暂无作品。</li>}
          </ul>
        </Card>

        <Card title="最近审计日志">
          <ul className="max-h-72 space-y-1 overflow-auto text-xs">
            {audits.map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-b border-ink-900/5 py-1.5 last:border-0">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink-800">{a.actorName}</span>
                  <span className="text-ink-600"> {auditActionLabel(a.action)} </span>
                  <span className="text-ink-500">{AUDIT_TARGET_LABELS[a.targetType] ?? a.targetType}</span>
                </span>
                <span className="tnum shrink-0 text-ink-500">{new Date(a.createdAt).toLocaleString("zh-CN")}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

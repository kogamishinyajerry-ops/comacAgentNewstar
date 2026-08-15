import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { participantWorkspace } from "@/lib/progress-server";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { Badge, EmptyState, LinkButton, PageHeader, ProgressBar, ProgressRing, StatusBadge, cn } from "@/components/ui";
import { NewProjectButton } from "./new-project-button";
import { WorkspaceNotices } from "./workspace-notices";
import { WorkspaceGamification } from "@/components/workspace-gamification";

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline.replace(/(\d{4}-\d{2}-\d{2}).*/, "$1") + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

const stepDot: Record<string, string> = {
  done: "bg-emerald-500 text-white",
  in_progress: "bg-amber-400 text-white",
  todo: "bg-slate-200 text-slate-500",
  blocked: "bg-red-500 text-white",
};

export default async function WorkspacePage() {
  const user = await requireUser();
  const data = await participantWorkspace(user.id);
  const dl = daysLeft(data.deadline);

  const active = data.rows.find((r) => !["SUBMITTED", "PRELIMINARY", "FINAL"].includes(r.status)) ?? data.rows[0];
  const unreadNotices = data.notices.filter((n) => !n.read);

  return (
    <div className="grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <PageHeader
          title={`你好,${user.name}`}
          desc="按自己的节奏推进——每一步都有填写示例,右侧Agent随时陪跑,卡住了来Office Hour也行。"
          actions={
            dl != null ? (
              <Badge tone={dl < 0 ? "red" : dl <= 7 ? "amber" : "gray"}>
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <circle cx="8" cy="8" r="6.2" />
                  <path d="M8 4.8V8l2 1.6" strokeLinecap="round" />
                </svg>
                {dl < 0 ? "提交已截止" : dl === 0 ? "今天截止" : `距提交截止 ${dl} 天`}
              </Badge>
            ) : undefined
          }
        />

        {unreadNotices.length > 0 && (
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-200/80 bg-blue-50/70 px-3.5 py-2.5 text-[13px] text-blue-900">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px]">🔔</span>
            你有 {unreadNotices.length} 条组织者提醒,
            <Link href="/notices" className="font-semibold underline underline-offset-2">查看</Link>
          </div>
        )}

        {/* 继续上次 */}
        {active ? (
          <div className="surface-card relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-700" />
            <div className="flex flex-wrap items-center gap-5 px-5 pb-5 pt-6">
              <ProgressRing pct={active.progress.overallPct} size={84} stroke={7} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">继续上次的位置</p>
                <h2 className="mt-0.5 truncate text-[17px] font-semibold tracking-tight text-slate-900">{active.title}</h2>
                <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-slate-600">
                  <span className="mt-0.5 text-brand-500">👉</span>
                  <span>
                    最小下一步:<span className="font-medium text-slate-900">{active.progress.nextHint}</span>
                  </span>
                </p>
              </div>
              <LinkButton href={`/projects/${active.projectId}?step=${active.progress.currentStep}`} size="lg">
                继续 →
              </LinkButton>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                <span>10 步健康度</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-emerald-500" />完成</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" />进行中</span>
                  <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-red-500" />阻塞</span>
                </span>
              </div>
              <ol className="flex flex-wrap gap-1.5">
                {active.progress.steps.map((s) => (
                  <li
                    key={s.step}
                    title={`${s.step}.${s.title}${s.missing.length ? `(待补:${s.missing.join("、")})` : " ✓"}`}
                    className={cn(
                      "flex h-7 w-7 cursor-default items-center justify-center rounded-lg text-xs font-bold ring-1 ring-inset ring-black/[0.03]",
                      stepDot[s.status]
                    )}
                  >
                    {s.step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <EmptyState
            title="从一个真实的小麻烦开始"
            desc="不用想宏大,先想你或同事每周都要重复做、还容易出错的那件事。"
            action={data.team ? <NewProjectButton /> : <LinkButton href="/projects/new-team">创建队伍</LinkButton>}
          />
        )}

        {/* 我的项目 */}
        {data.rows.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">我的想法 · {data.rows.length}</h2>
              {data.team && <NewProjectButton />}
            </div>
            <div className="grid gap-2.5">
              {data.rows.map((r) => (
                <div key={r.projectId} className="surface-card surface-card-hover p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/projects/${r.projectId}`} className="text-[14px] font-medium text-slate-900 hover:text-brand-600">
                      {r.title}
                    </Link>
                    <span className="flex items-center gap-1.5">
                      <StatusBadge status={r.status} />
                      <span className="tnum text-xs font-semibold text-slate-600">{r.progress.overallPct}%</span>
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar pct={r.progress.overallPct} tone={r.progress.overallPct >= 100 ? "green" : "brand"} />
                  </div>
                  <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="min-w-0 flex-1 truncate">{r.progress.nextHint}</span>
                    <Badge tone={r.progress.tests.passOk && r.progress.tests.coverageOk ? "green" : "slate"}>
                      测试 {r.progress.tests.count}/5
                    </Badge>
                    <Badge tone={r.progress.closedLoopOk ? "green" : "amber"}>
                      闭环{r.progress.closedLoopOk ? "✓" : "缺要素"}
                    </Badge>
                    <span className="tnum text-slate-400">
                      {r.progress.staleDays === 0 ? "今天有更新" : `${r.progress.staleDays}天前更新`}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 侧栏 */}
      <aside className="space-y-3">
        <div className="surface-card p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">我的队伍</h3>
          {data.team ? (
            <div className="mt-2 text-[13px]">
              <p className="font-semibold text-slate-800">{data.team.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {TEAM_MODE_LABELS[data.team.mode as keyof typeof TEAM_MODE_LABELS] ?? data.team.mode}
              </p>
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500">
                邀请码
                <code className="tnum rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] font-bold tracking-[0.15em] text-slate-700">
                  {data.team.inviteCode}
                </code>
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2.5 text-[13px] text-slate-500">
              <p>还没有队伍,单人可参赛。</p>
              <div className="flex gap-2">
                <LinkButton href="/projects/new-team" size="sm">创建队伍</LinkButton>
                <LinkButton href="/join" size="sm" variant="secondary">邀请码加入</LinkButton>
              </div>
            </div>
          )}
        </div>

        {active && (
          <div className="surface-card p-4">
            <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">我的段位 · {active.title}</h3>
            <WorkspaceGamification
              projectId={active.projectId}
              title={active.title}
              progress={active.progress}
              teamExists={!!data.team}
              feedbackCount={active.feedbackCount}
              hasSnapshot={active.hasSnapshot}
              submitted={["SUBMITTED", "PRELIMINARY", "FINAL"].includes(active.status)}
              hasDocumentedFailure={active.hasDocumentedFailure}
            />
          </div>
        )}

        <WorkspaceNotices notices={data.notices} />

        {data.pendingSuggestions > 0 && (
          <div className="rounded-lg border border-brand-200/80 bg-gradient-to-br from-brand-50 to-white p-4">
            <p className="text-[13px] font-semibold text-brand-800">Agent 有 {data.pendingSuggestions} 条建议待处理</p>
            <p className="mt-1 text-xs leading-4 text-brand-600/90">在项目页右侧辅导栏标记「已采纳/忽略/已处理」即可。</p>
          </div>
        )}

        <div className="surface-card p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">最新公告</h3>
          <ul className="mt-2 space-y-2.5">
            {data.announcements.map((a) => (
              <li key={a.id} className="text-xs">
                <p className="font-semibold text-slate-700">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 leading-4 text-slate-500">{a.body}</p>
              </li>
            ))}
            {data.announcements.length === 0 && <li className="text-xs text-slate-400">暂无公告</li>}
          </ul>
        </div>

        {data.officeHour && (
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Office Hour</h3>
            <p className="mt-1.5 text-[13px] font-semibold text-emerald-900">{data.officeHour.title}</p>
            <p className="mt-0.5 text-xs text-emerald-700/90">{data.officeHour.time} · {data.officeHour.host}</p>
            <Link href="/office-hours" className="mt-2 inline-block text-xs font-medium text-emerald-800 underline underline-offset-2">查看全部场次 →</Link>
          </div>
        )}
      </aside>
    </div>
  );
}

import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { participantWorkspace } from "@/lib/progress-server";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { Badge, EmptyState, LinkButton, StatusBadge, cn } from "@/components/ui";
import { NewProjectButton } from "./new-project-button";
import { WorkspaceNotices } from "./workspace-notices";

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline.replace(/(\d{4}-\d{2}-\d{2}).*/, "$1") + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function ProgressBar({ pct, tone }: { pct: number; tone?: "brand" | "green" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-all", tone === "green" ? "bg-emerald-500" : "bg-brand-600")}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
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

  // 继续上次:最近活动且未提交的项目;都在评审中则取最新
  const active = data.rows.find((r) => !["SUBMITTED", "PRELIMINARY", "FINAL"].includes(r.status)) ?? data.rows[0];
  const unreadNotices = data.notices.filter((n) => !n.read);

  return (
    <div className="grid gap-5 py-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {/* 顶部:欢迎与截止 */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">你好,{user.name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                按自己的节奏推进——每一步都有填写示例,右侧Agent随时陪跑,卡住了来Office Hour也行。
              </p>
            </div>
            {dl != null && (
              <Badge tone={dl < 0 ? "red" : dl <= 7 ? "amber" : "gray"}>
                {dl < 0 ? "提交已截止" : dl === 0 ? "今天截止" : `距提交截止还有 ${dl} 天`}
              </Badge>
            )}
          </div>
          {unreadNotices.length > 0 && (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              🔔 你有 {unreadNotices.length} 条组织者提醒,<Link href="/notices" className="font-medium underline">查看</Link>
            </div>
          )}
        </div>

        {/* 继续上次 */}
        {active ? (
          <div className="rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-brand-600">继续上次的位置</p>
                <h2 className="mt-0.5 truncate text-lg font-semibold text-slate-900">{active.title}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  👉 最小下一步:<span className="font-medium">{active.progress.nextHint}</span>
                </p>
              </div>
              <LinkButton href={`/projects/${active.projectId}?step=${active.progress.currentStep}`}>
                继续 →
              </LinkButton>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                <span>整体进度</span>
                <span className="font-semibold text-slate-700">{active.progress.overallPct}%</span>
              </div>
              <ProgressBar pct={active.progress.overallPct} tone={active.progress.urgent ? "brand" : "green"} />
              <ol className="mt-3 flex flex-wrap gap-1 text-[10px]">
                {active.progress.steps.map((s) => (
                  <li
                    key={s.step}
                    title={`${s.step}.${s.title}${s.missing.length ? `(待补:${s.missing.join("、")})` : " ✓"}`}
                    className={cn("flex h-6 w-6 items-center justify-center rounded-full font-bold", stepDot[s.status])}
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">我的想法({data.rows.length})</h2>
              {data.team && <NewProjectButton />}
            </div>
            {data.rows.map((r) => (
              <div key={r.projectId} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-400">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/projects/${r.projectId}`} className="font-medium text-slate-900 hover:text-brand-600">
                    {r.title}
                  </Link>
                  <span className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    <Badge tone="gray">{r.progress.overallPct}%</Badge>
                  </span>
                </div>
                <div className="mt-2"><ProgressBar pct={r.progress.overallPct} /></div>
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{r.progress.nextHint}</span>
                  <Badge tone={r.progress.tests.passOk && r.progress.tests.coverageOk ? "green" : "gray"}>
                    测试{r.progress.tests.count}/5
                  </Badge>
                  <Badge tone={r.progress.closedLoopOk ? "green" : "amber"}>
                    {r.progress.closedLoopOk ? "闭环✓" : "闭环缺要素"}
                  </Badge>
                  <span>· {r.progress.staleDays === 0 ? "今天有更新" : `${r.progress.staleDays}天前更新`}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 侧栏:队伍/公告/OfficeHour/Agent */}
      <aside className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">我的队伍</h3>
          {data.team ? (
            <div className="mt-2 text-sm text-slate-600">
              <p className="font-medium">{data.team.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {TEAM_MODE_LABELS[data.team.mode as keyof typeof TEAM_MODE_LABELS] ?? data.team.mode}
              </p>
              <p className="mt-2 text-xs">
                邀请码 <code className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold tracking-widest">{data.team.inviteCode}</code>
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-sm text-slate-500">
              <p>还没有队伍,单人可参赛。</p>
              <div className="flex gap-2">
                <LinkButton href="/projects/new-team" size="sm">创建队伍</LinkButton>
                <LinkButton href="/join" size="sm" variant="secondary">邀请码加入</LinkButton>
              </div>
            </div>
          )}
        </div>

        <WorkspaceNotices notices={data.notices} />

        {data.pendingSuggestions > 0 && (
          <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
            <p className="font-medium">Agent 有 {data.pendingSuggestions} 条建议待你处理</p>
            <p className="mt-1 text-xs text-brand-600">在项目页右侧辅导栏标记「已采纳/忽略/已处理」即可。</p>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-700">最新公告</h3>
          <ul className="mt-2 space-y-2">
            {data.announcements.map((a) => (
              <li key={a.id} className="text-xs">
                <p className="font-medium text-slate-700">{a.title}</p>
                <p className="mt-0.5 line-clamp-2 text-slate-500">{a.body}</p>
              </li>
            ))}
            {data.announcements.length === 0 && <li className="text-xs text-slate-400">暂无公告</li>}
          </ul>
        </div>

        {data.officeHour && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <h3 className="font-semibold text-emerald-800">Office Hour</h3>
            <p className="mt-1 text-xs text-emerald-700">{data.officeHour.title}</p>
            <p className="mt-0.5 text-xs text-emerald-600">{data.officeHour.time} · {data.officeHour.host}</p>
            <Link href="/office-hours" className="mt-2 inline-block text-xs font-medium text-emerald-800 underline">查看全部场次 →</Link>
          </div>
        )}
      </aside>
    </div>
  );
}

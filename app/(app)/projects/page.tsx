import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  participantWorkspace,
  type ProjectProgressRow,
} from "@/lib/progress-server";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { evidenceGapCandidate } from "@/lib/project-evidence";
import {
  Badge,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { NewProjectButton } from "./new-project-button";
import { WorkspaceNotices } from "./workspace-notices";

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline.replace(/(\d{4}-\d{2}-\d{2}).*/, "$1") + "T23:59:59");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

function evidenceSignals(row: ProjectProgressRow) {
  const hasProblemRecord = row.progress.steps.find((step) => step.step === 4)?.status === "done";
  return [
    { label: "问题定义记录", state: hasProblemRecord ? "已有记录" : "待记录" },
    { label: "验证案例", state: `已记录 ${row.progress.tests.count} 条` },
    { label: "失败记录", state: row.hasDocumentedFailure ? "已有记录" : "暂无记录" },
    { label: "不适用记录", state: row.hasNotApplicableRecord ? "已有记录" : "暂无记录" },
    { label: "提交快照", state: row.hasSnapshot ? "已有快照" : "尚无快照" },
  ];
}

function gapCandidate(row: ProjectProgressRow): string {
  return evidenceGapCandidate({
    status: row.status,
    blocker: row.blocker,
    nextHint: row.progress.nextHint,
  });
}

function EvidenceStrip({
  row,
  compact = false,
}: {
  row: ProjectProgressRow;
  compact?: boolean;
}) {
  return (
    <ul
      className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}
      aria-label="证据记录状态，不代表验证结论"
    >
      {evidenceSignals(row).map((item) => (
        <li key={item.label}>
          <Badge tone="slate">
            {item.label} · {item.state}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

export default async function WorkspacePage() {
  const user = await requireUser();
  const data = await participantWorkspace(user.id);
  const dl = daysLeft(data.deadline);
  const active =
    data.rows.find((row) => !["SUBMITTED", "PRELIMINARY", "FINAL"].includes(row.status)) ??
    data.rows[0];
  const unreadNotices = data.notices.filter((notice) => !notice.read);

  return (
    <div className="grid gap-5 py-2 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <PageHeader
          title={`你好，${user.name}`}
          desc="这里不展示健康分或伪精确完成率。你只需要看清当前主张、已有流程记录，以及仍待验证的一条缺口。"
          actions={
            dl != null ? (
              <Badge tone={dl < 0 ? "red" : dl <= 7 ? "amber" : "gray"}>
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[11px]" aria-hidden>
              铃
            </span>
            你有 {unreadNotices.length} 条组织者提醒，
            <Link href="/notices" className="font-semibold underline underline-offset-2">
              查看
            </Link>
          </div>
        )}

        {active ? (
          <section className="surface-card relative overflow-hidden" aria-labelledby="active-project-title">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-[58%] opacity-[0.18]"
              aria-hidden="true"
              style={{
                backgroundImage: "url('/hub/art/hub-hero-cognitive-canvas.webp')",
                backgroundPosition: "35% center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
                maskImage: "linear-gradient(90deg, transparent, black 35%)",
              }}
            />
            <div className="relative p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-600">
                    继续上次的位置
                  </p>
                  <h2 id="active-project-title" className="mt-1 text-[20px] font-semibold tracking-tight text-slate-900">
                    {active.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={active.status} />
                    <span className="text-xs text-slate-500">
                      {active.progress.staleDays === 0
                        ? "今天有更新"
                        : `${active.progress.staleDays} 天前更新`}
                    </span>
                  </div>
                </div>
                <LinkButton href={`/projects/${active.projectId}/chat`} size="lg">
                  继续和 Agent 打磨 →
                </LinkButton>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1.15fr_1fr]">
                <div className="rounded-lg border border-slate-200/80 bg-white/75 p-4 backdrop-blur-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    当前主张 · 待你确认
                  </p>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-slate-700">
                    {active.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    当前沿用项目命名，不代表已经形成或验证正式结论。
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/55 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    证据状态 · 记录不等于结论
                  </p>
                  <div className="mt-2.5">
                    <EvidenceStrip row={active} />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-emerald-900/75">
                    当前仅汇总已有流程记录；独立证据资产接回仍属后续能力。
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    当前最大缺口 · 待你确认
                  </p>
                  <p className="mt-2 text-[13px] font-medium leading-6 text-amber-950">
                    {gapCandidate(active)}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-brand-200/70 bg-brand-50/55 px-3.5 py-3 text-[13px] text-brand-900">
                <span className="mt-px" aria-hidden>→</span>
                <p>
                  <span className="font-semibold">最小下一步：</span>
                  {active.progress.nextHint}
                </p>
              </div>
            </div>
          </section>
        ) : (
          <EmptyState
            title="从一个真实的小麻烦开始"
            desc="不用想宏大，先想你或同事每周都要重复做、还容易出错的那件事。"
            action={
              data.team ? (
                <NewProjectButton />
              ) : (
                <LinkButton href="/projects/new-team">创建队伍</LinkButton>
              )
            }
          />
        )}

        {data.rows.length > 0 && (
          <section className="space-y-2.5" aria-labelledby="project-list-title">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="project-list-title" className="text-[13px] font-semibold uppercase tracking-wider text-slate-500">
                  我的实践 · {data.rows.length}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  不比较百分比，只核对现有记录与仍待验证之处。
                </p>
              </div>
              {data.team && <NewProjectButton />}
            </div>

            <div className="grid gap-2.5">
              {data.rows.map((row) => (
                <article key={row.projectId} className="surface-card surface-card-hover p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/projects/${row.projectId}/chat`}
                          className="text-[14px] font-semibold text-slate-900 hover:text-brand-600"
                        >
                          {row.title}
                        </Link>
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="mt-2.5">
                        <EvidenceStrip row={row} compact />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        <span className="font-semibold text-slate-700">候选缺口：</span>
                        {gapCandidate(row)}
                      </p>
                    </div>
                    <LinkButton href={`/projects/${row.projectId}/chat`} size="sm" variant="secondary">
                      打开
                    </LinkButton>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      <aside className="space-y-3" aria-label="协作与支持">
        <section className="surface-card p-4" aria-labelledby="team-title">
          <h2 id="team-title" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            我的队伍
          </h2>
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
              <p>还没有队伍，单人可参赛。</p>
              <div className="flex gap-2">
                <LinkButton href="/projects/new-team" size="sm">创建队伍</LinkButton>
                <LinkButton href="/join" size="sm" variant="secondary">邀请码加入</LinkButton>
              </div>
            </div>
          )}
        </section>

        <WorkspaceNotices notices={data.notices} />

        {data.pendingSuggestions > 0 && (
          <section className="rounded-lg border border-brand-200/80 bg-gradient-to-br from-brand-50 to-white p-4">
            <p className="text-[13px] font-semibold text-brand-800">
              Agent 有 {data.pendingSuggestions} 条建议待你判断
            </p>
            <p className="mt-1 text-xs leading-5 text-brand-600/90">
              建议不是指令。进入项目后逐条标记「采纳 / 忽略 / 已处理」。
            </p>
          </section>
        )}

        <section className="surface-card p-4" aria-labelledby="announcement-title">
          <h2 id="announcement-title" className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            最新公告
          </h2>
          <ul className="mt-2 space-y-2.5">
            {data.announcements.map((announcement) => (
              <li key={announcement.id} className="text-xs">
                <p className="font-semibold text-slate-700">{announcement.title}</p>
                <p className="mt-0.5 line-clamp-2 leading-4 text-slate-500">{announcement.body}</p>
              </li>
            ))}
            {data.announcements.length === 0 && (
              <li className="text-xs text-slate-400">暂无公告</li>
            )}
          </ul>
        </section>

        {data.officeHour && (
          <section className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-4">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Office Hour</h2>
            <p className="mt-1.5 text-[13px] font-semibold text-emerald-900">{data.officeHour.title}</p>
            <p className="mt-0.5 text-xs text-emerald-700/90">
              {data.officeHour.time} · {data.officeHour.host}
            </p>
            <Link
              href="/office-hours"
              className="mt-2 inline-block text-xs font-medium text-emerald-800 underline underline-offset-2"
            >
              查看全部场次 →
            </Link>
          </section>
        )}
      </aside>
    </div>
  );
}

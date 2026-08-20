import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { organizerProgress } from "@/lib/progress-server";
import { TRACKS } from "@/lib/constants";
import { Badge, Card, ProgressBar, StatusBadge, Table, Td, Th, cn } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { NudgeButton } from "./nudge-button";
import { ExportLink } from "../export-link";

const stepDot: Record<string, string> = {
  done: "bg-emerald-500 text-white",
  in_progress: "bg-amber-400 text-white",
  todo: "bg-slate-200 text-slate-500",
  blocked: "bg-red-500 text-white",
};

function Funnel({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
      {items.map((i, idx) => (
        <div key={i.label} className="surface-card px-3 py-2.5">
          <p className="text-[11px] font-medium tracking-wide text-ink-500">{i.label}</p>
          <p className="font-display tnum mt-0.5 text-xl font-bold tracking-tight text-ink-900">{i.value}</p>
          <div className="mt-1.5 h-1 rounded-full bg-ink-100">
            <div
              className={cn("h-full rounded-full transition-[width] duration-500 ease-out", idx >= 5 ? "bg-brand-600" : idx >= 3 ? "bg-emerald-500" : "bg-ink-200")}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function AllClear() {
  return (
    <p className="flex items-center gap-2 py-1 text-[13px] text-ink-500">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/80" aria-hidden>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="#0f7564" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="m2.5 6.2 2.4 2.4 4.6-5.4" />
        </svg>
      </span>
      暂无,一切正常。
    </p>
  );
}

export default async function OrganizerProgressPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const { rows, funnel, deadline, daysToDeadline, alerts } = await organizerProgress();

  const alertBlocks = [
    {
      title: `停滞提醒(≥5天未动,${alerts.stale.length}个)`,
      tone: "amber" as const,
      items: alerts.stale.map((r) => `${r.title} · ${r.progress.staleDays}天未更新 · 卡点:${r.blocker}`),
    },
    {
      title: `临期未提交(截止${deadline ?? "未设置"}${daysToDeadline != null ? `,还剩${daysToDeadline}天` : ""},${alerts.nearDeadline.length}个)`,
      tone: "red" as const,
      items: alerts.nearDeadline.map((r) => `${r.title} · ${r.progress.overallPct}% · ${r.blocker}`),
    },
    {
      title: `退回待处理(${alerts.returnedPending.length}个)`,
      tone: "blue" as const,
      items: alerts.returnedPending.map((r) => `${r.title} · ${r.blocker}`),
    },
  ];

  return (
    <div className="space-y-5 py-2">
      <Reveal>
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="kicker">Progress Command</p>
            <h1 className="font-display mt-2 text-display-lg text-ink-900">项目进展中枢</h1>
            <p className="mt-2 max-w-2xl text-caption text-ink-500">
              全部作品的健康度一屏可见:漏斗、卡点、停滞与临期预警,一键温和催办。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ExportLink href="/api/organizer/export?type=projects" label="导出CSV" />
          </div>
        </header>
      </Reveal>

      <Reveal delayMs={70}>
        <Card title="参与漏斗">
          <Funnel
            items={[
              { label: "注册参与者", value: funnel.participants },
              { label: "已组队", value: funnel.teamed },
              { label: "已建作品", value: funnel.projects },
              { label: "完成4-6步", value: funnel.coreDone },
              { label: "测试达标", value: funnel.testsOk },
              { label: "已提交", value: funnel.submitted },
              { label: "已归档", value: funnel.archived },
            ]}
          />
        </Card>
      </Reveal>

      <Reveal delayMs={140}>
        <div className="grid gap-3 md:grid-cols-3">
          {alertBlocks.map((b) => (
            <Card
              key={b.title}
              title={
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      b.tone === "red" ? "bg-red-500" : b.tone === "amber" ? "bg-amber-500" : "bg-blue-500"
                    )}
                  />
                  {b.title}
                </span>
              }
            >
              {b.items.length === 0 ? (
                <AllClear />
              ) : (
                <ul className="space-y-1.5 text-xs text-ink-600">
                  {b.items.slice(0, 6).map((t, i) => (
                    <li key={i} className="rounded-md border border-ink-900/10 bg-ink-50/50 px-2.5 py-1.5 leading-5">{t}</li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </Reveal>

      <Card title={`作品矩阵 · ${rows.length}`} bodyClassName="px-4 py-1">
        <Table>
          <thead>
            <tr>
              <Th className="w-44">作品</Th>
              <Th className="min-w-28">队伍</Th>
              <Th className="min-w-20">状态</Th>
              <Th className="w-32">进度</Th>
              <Th className="min-w-36">10步健康度</Th>
              <Th className="min-w-52">当前卡点 / 最小下一步</Th>
              <Th className="min-w-20">最后活动</Th>
              <Th className="min-w-24">催办</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const inWork = !["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"].includes(r.status);
              return (
                <tr key={r.projectId} className="group transition-colors hover:bg-ink-50/60">
                  <Td>
                    <Link href={`/projects/${r.projectId}`} className="font-medium text-ink-800 transition-colors hover:text-brand-600">{r.title}</Link>
                    <p className="mt-0.5 text-[11px] text-ink-500">{TRACKS.find((t) => t.key === r.track)?.name ?? "未选赛道"}</p>
                  </Td>
                  <Td className="text-xs text-ink-600">
                    {r.teamName}
                    <br />
                    <span className="text-ink-500">{r.memberNames.join("、")}</span>
                  </Td>
                  <Td><StatusBadge status={r.status} /></Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={r.progress.overallPct} tone={r.progress.overallPct >= 100 ? "green" : "brand"} height="h-1" />
                      <span className="tnum text-xs font-semibold text-ink-600">{r.progress.overallPct}%</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="flex max-w-[128px] flex-wrap gap-0.5">
                      {r.progress.steps.map((s) => (
                        <span key={s.step} title={`${s.step}.${s.title} ${s.missing.join("、")}`} className={cn("flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold", stepDot[s.status])}>
                          {s.step}
                        </span>
                      ))}
                    </span>
                  </Td>
                  <Td className="text-xs">
                    <span className={cn("font-medium", r.progress.urgent ? "text-red-600" : "text-ink-700")}>{r.blocker}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={r.progress.tests.passOk && r.progress.tests.coverageOk ? "green" : "slate"}>测{r.progress.tests.count}/5</Badge>
                      <Badge tone={r.progress.closedLoopOk ? "green" : "amber"}>闭环{r.progress.closedLoopOk ? "✓" : "缺"}</Badge>
                      <Badge tone={r.progress.disclosureOk ? "green" : "amber"}>披露{r.progress.disclosureOk ? "✓" : "缺"}</Badge>
                    </span>
                  </Td>
                  <Td className="tnum text-xs text-ink-500">
                    {r.progress.staleDays === 0 ? "今天" : `${r.progress.staleDays}天前`}
                  </Td>
                  <Td>
                    {inWork ? <NudgeButton projectId={r.projectId} title={r.title} nextHint={r.progress.nextHint} /> : <span className="text-xs text-ink-300">—</span>}
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><Td colSpan={8} className="py-8 text-center text-ink-500">暂无作品</Td></tr>
            )}
          </tbody>
        </Table>
        <p className="px-0 py-2.5 text-xs leading-5 text-ink-500">
          催办会向该队全员发送站内通知(默认话术无压力、附系统计算的最小下一步);未提交草稿全文仍对本页不可见,只见进度与卡点。
        </p>
      </Card>
    </div>
  );
}

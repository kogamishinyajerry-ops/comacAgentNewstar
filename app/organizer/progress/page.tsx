import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { organizerProgress } from "@/lib/progress-server";
import { TRACKS } from "@/lib/constants";
import { Badge, Card, StatusBadge, cn } from "@/components/ui";
import { NudgeButton } from "./nudge-button";

const stepDot: Record<string, string> = {
  done: "bg-emerald-500 text-white",
  in_progress: "bg-amber-400 text-white",
  todo: "bg-slate-200 text-slate-500",
  blocked: "bg-red-500 text-white",
};

function Funnel({ items }: { items: { label: string; value: number; tone?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
      {items.map((i) => (
        <div key={i.label} className="rounded-md border border-slate-100 p-2 text-center">
          <p className="text-xl font-bold text-slate-800">{i.value}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{i.label}</p>
          <div className="mt-1 h-1 rounded bg-slate-100">
            <div className={cn("h-full rounded", i.tone ?? "bg-brand-500")} style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
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
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">项目进展中枢</h1>
          <p className="mt-1 text-sm text-slate-500">全部作品的健康度一屏可见:漏斗、卡点、停滞与临期预警,一键温和催办。</p>
        </div>
        <a href="/api/organizer/export?type=projects" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100">导出CSV</a>
      </div>

      <Card title="参与漏斗">
        <Funnel
          items={[
            { label: "注册参与者", value: funnel.participants },
            { label: "已组队", value: funnel.teamed },
            { label: "已建作品", value: funnel.projects },
            { label: "完成4-6步", value: funnel.coreDone, tone: "bg-emerald-500" },
            { label: "测试达标", value: funnel.testsOk, tone: "bg-emerald-500" },
            { label: "已提交", value: funnel.submitted, tone: "bg-brand-600" },
            { label: "已归档", value: funnel.archived },
          ]}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {alertBlocks.map((b) => (
          <Card key={b.title} title={b.title}>
            {b.items.length === 0 ? (
              <p className="text-sm text-slate-400">无 🎉</p>
            ) : (
              <ul className="space-y-1.5 text-xs text-slate-600">
                {b.items.slice(0, 6).map((t, i) => (
                  <li key={i} className="rounded border border-slate-100 px-2 py-1">{t}</li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>

      <Card title={`作品矩阵(${rows.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-2 pr-3">作品</th>
                <th className="py-2 pr-3">队伍</th>
                <th className="py-2 pr-3">状态</th>
                <th className="py-2 pr-3 w-40">进度</th>
                <th className="py-2 pr-3">10步健康度</th>
                <th className="py-2 pr-3">当前卡点 / 最小下一步</th>
                <th className="py-2 pr-3">最后活动</th>
                <th className="py-2">催办</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inWork = !["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"].includes(r.status);
                return (
                  <tr key={r.projectId} className="border-b border-slate-50 align-top">
                    <td className="py-2.5 pr-3">
                      <Link href={`/projects/${r.projectId}`} className="font-medium text-slate-800 hover:text-brand-600">{r.title}</Link>
                      <p className="mt-0.5 text-[11px] text-slate-400">{TRACKS.find((t) => t.key === r.track)?.name ?? "未选赛道"}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600">
                      {r.teamName}
                      <br />
                      {r.memberNames.join("、")}
                    </td>
                    <td className="py-2.5 pr-3"><StatusBadge status={r.status} /></td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className={cn("h-full", r.progress.overallPct >= 100 ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${r.progress.overallPct}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{r.progress.overallPct}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="flex max-w-[120px] flex-wrap gap-0.5">
                        {r.progress.steps.map((s) => (
                          <span key={s.step} title={`${s.step}.${s.title} ${s.missing.join("、")}`} className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", stepDot[s.status])}>
                            {s.step}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs">
                      <span className={cn("font-medium", r.progress.urgent ? "text-red-600" : "text-slate-700")}>{r.blocker}</span>
                      <span className="mt-0.5 flex gap-1">
                        <Badge tone={r.progress.tests.passOk && r.progress.tests.coverageOk ? "green" : "gray"}>测{r.progress.tests.count}/5</Badge>
                        <Badge tone={r.progress.closedLoopOk ? "green" : "amber"}>闭环{r.progress.closedLoopOk ? "✓" : "缺"}</Badge>
                        <Badge tone={r.progress.disclosureOk ? "green" : "amber"}>披露{r.progress.disclosureOk ? "✓" : "缺"}</Badge>
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">
                      {r.progress.staleDays === 0 ? "今天" : `${r.progress.staleDays}天前`}
                    </td>
                    <td className="py-2.5">
                      {inWork ? <NudgeButton projectId={r.projectId} title={r.title} nextHint={r.progress.nextHint} /> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-sm text-slate-400">暂无作品</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          催办会向该队全员发送站内通知(默认话术无压力、附系统计算的最小下一步);未提交草稿全文仍对本页不可见,只见进度与卡点。
        </p>
      </Card>
    </div>
  );
}

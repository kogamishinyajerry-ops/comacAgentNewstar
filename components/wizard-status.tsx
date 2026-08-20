"use client";

import { Check } from "lucide-react";
import { STATUS_LABELS, PROJECT_STATUSES } from "@/lib/constants";
import { Badge, Card, cn } from "./ui";
import { ArtGallery } from "./gallery";
import type { WizardData } from "./wizard-types";

const tracking = [
  { day: "30天", desc: "解法是否还在被自己/他人使用?记录一次真实使用。" },
  { day: "60天", desc: "指标是否维持?有没有扩散到第二个用户?" },
  { day: "90天", desc: "值得继续做还是归档?一句话复盘。" },
];

export function StatusStep({ data }: { data: WizardData }) {
  const currentIdx = PROJECT_STATUSES.indexOf(data.status as never);
  return (
    <div className="space-y-4">
      <Card title="状态流转">
        {/* 空间叙事:已走过(青绿✓)→ 当前(朱砂)→ 未到达(纸面) */}
        <ol className="flex flex-wrap items-center gap-y-2 text-xs" aria-label="作品状态流转">
          {PROJECT_STATUSES.map((s, i) => (
            <li key={s} className="flex items-center">
              <span
                aria-current={s === data.status ? "step" : undefined}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors",
                  s === data.status
                    ? "bg-brand-600 font-semibold text-white shadow-[0_1px_2px_rgba(124,47,24,0.3),0_4px_12px_-2px_rgba(185,74,38,0.4)]"
                    : currentIdx > i
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "bg-ink-50 text-ink-400 ring-1 ring-inset ring-ink-900/10"
                )}
              >
                {currentIdx > i && <Check size={11} strokeWidth={3} aria-hidden />}
                {STATUS_LABELS[s]}
              </span>
              {i < PROJECT_STATUSES.length - 1 && (
                <span
                  className={cn("mx-1.5 h-px w-4", currentIdx > i ? "bg-emerald-300" : "bg-ink-900/15")}
                  aria-hidden
                />
              )}
            </li>
          ))}
        </ol>
        {data.status === "RETURNED" && data.returnReason && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            退回原因:{data.returnReason}
          </p>
        )}
      </Card>

      <Card title="历史版本(提交快照不可变)">
        {data.snapshots.length === 0 ? (
          <p className="text-sm text-ink-400">尚未提交,暂无快照。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.snapshots.map((s) => (
              <li
                key={s.version}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-ink-50"
              >
                <span className="flex items-center gap-2">
                  <Badge tone="indigo">v{s.version}</Badge>
                  <time className="tnum text-xs text-ink-500">{new Date(s.createdAt).toLocaleString("zh-CN")}</time>
                </span>
                <a
                  className="text-xs font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
                  href={`/projects/${data.projectId}/card?version=${s.version}`}
                  target="_blank"
                >
                  查看快照小实验卡 →
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Agent 反馈历史">
        {data.feedbacks.length === 0 ? (
          <p className="text-sm text-ink-400">还没有Agent诊断记录。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...data.feedbacks]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 10)
              .map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-ink-600 transition-colors hover:bg-ink-50"
                >
                  <span className="min-w-0 truncate">
                    第{f.step}步 · {f.purpose === "PRECHECK" ? "预检" : "辅导"} · {f.content.summary.slice(0, 40)}
                  </span>
                  <time className="tnum shrink-0 text-xs text-ink-400">{new Date(f.createdAt).toLocaleString("zh-CN")}</time>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card title="插画图鉴 · 里程碑的专属记忆">
        <ArtGallery projectId={data.projectId} />
        <p className="mt-3 text-xs leading-5 text-ink-400">
          每张插画由 MiniMax 根据项目内容即兴创作,全球唯一;完成对应里程碑或解锁史诗成就即可收集。
        </p>
      </Card>

      <Card title="活动后跟踪(30/60/90天)">
        <ul className="space-y-2.5 text-sm text-ink-600">
          {tracking.map((t) => (
            <li key={t.day} className="flex items-baseline gap-2.5">
              <Badge tone="gray">{t.day}</Badge>
              <span>{t.desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-xs text-ink-400">活动结束后由组织者发起简短跟踪,参与者一句话回复即可。</p>
      </Card>
    </div>
  );
}

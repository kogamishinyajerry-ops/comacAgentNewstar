"use client";

import { STATUS_LABELS, PROJECT_STATUSES } from "@/lib/constants";
import { Badge, Card } from "./ui";
import type { WizardData } from "./wizard-types";

const tracking = [
  { day: "30天", desc: "解法是否还在被自己/他人使用?记录一次真实使用。" },
  { day: "60天", desc: "指标是否维持?有没有扩散到第二个用户?" },
  { day: "90天", desc: "值得继续做还是归档?一句话复盘。" },
];

export function StatusStep({ data }: { data: WizardData }) {
  return (
    <div className="space-y-4">
      <Card title="状态流转">
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {PROJECT_STATUSES.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className={
                  s === data.status
                    ? "rounded-full bg-brand-600 px-2.5 py-1 font-semibold text-white"
                    : PROJECT_STATUSES.indexOf(data.status as never) > i
                      ? "rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700"
                      : "rounded-full bg-slate-100 px-2.5 py-1 text-slate-500"
                }
              >
                {STATUS_LABELS[s]}
              </span>
              {i < PROJECT_STATUSES.length - 1 && <span className="text-slate-300">→</span>}
            </li>
          ))}
        </ol>
        {data.status === "RETURNED" && data.returnReason && (
          <p className="mt-3 text-sm text-amber-700">退回原因:{data.returnReason}</p>
        )}
      </Card>

      <Card title="历史版本(提交快照不可变)">
        {data.snapshots.length === 0 ? (
          <p className="text-sm text-slate-400">尚未提交,暂无快照。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.snapshots.map((s) => (
              <li key={s.version} className="flex items-center justify-between">
                <span>
                  <Badge tone="indigo">v{s.version}</Badge>
                  <span className="ml-2 text-slate-500">{new Date(s.createdAt).toLocaleString("zh-CN")}</span>
                </span>
                <a
                  className="text-xs text-brand-600 hover:underline"
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
          <p className="text-sm text-slate-400">还没有Agent诊断记录。</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {[...data.feedbacks]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 10)
              .map((f) => (
                <li key={f.id} className="flex items-center justify-between text-slate-600">
                  <span>第{f.step}步 · {f.purpose === "PRECHECK" ? "预检" : "辅导"} · {f.content.summary.slice(0, 40)}</span>
                  <span className="text-xs text-slate-400">{new Date(f.createdAt).toLocaleString("zh-CN")}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card title="活动后跟踪(30/60/90天)">
        <ul className="space-y-2 text-sm text-slate-600">
          {tracking.map((t) => (
            <li key={t.day}>
              <Badge tone="gray">{t.day}</Badge>
              <span className="ml-2">{t.desc}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">活动结束后由组织者发起简短跟踪,参与者一句话回复即可。</p>
      </Card>
    </div>
  );
}

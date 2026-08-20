"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Textarea, cn } from "@/components/ui";
import { SuccessMark } from "@/components/fx";

const DIMENSIONS = [
  { key: "problemDefinition", label: "真问题与需求定义", desc: "问题真实、具体、有真实用户与场景" },
  { key: "originality", label: "原创过程与独立完成", desc: "披露如实,核心工作由1—2名参赛者完成" },
  { key: "closedLoop", label: "跑通闭环与人机边界", desc: "输入→处理→检查→人工确认→输出,责任清晰" },
  { key: "evidence", label: "验证证据与复盘", desc: "测试覆盖含失败案例,证据可核验" },
] as const;

type Scores = { problemDefinition: number; originality: number; closedLoop: number; evidence: number };

/* 自绘评分滑杆:消灭默认浏览器控件外观。
   WebKit 用 inline 渐变轨道(中心 6px 高),Firefox 由 ::-moz-range-track/progress 接管;
   轨道高 = 拇指高(18px),无需负边距对齐。 */
const rangeClass = cn(
  "h-[18px] w-full cursor-pointer appearance-none bg-transparent",
  "transition-opacity duration-150 ease-soft disabled:cursor-not-allowed disabled:opacity-50",
  // WebKit 拇指:纸面圆点 + 朱砂描边,hover 微放大、按压回缩
  "[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none",
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-brand-600",
  "[&::-webkit-slider-thumb]:bg-[#fffdf8] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(28,25,23,0.28)]",
  "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-150 [&::-webkit-slider-thumb]:ease-spring",
  "hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-95",
  // Firefox 轨道 / 已选段 / 拇指
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-ink-100",
  "[&::-moz-range-progress]:h-1.5 [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-brand-500",
  "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full",
  "[&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-brand-600 [&::-moz-range-thumb]:bg-[#fffdf8]"
);

export function ReviewForm({
  assignmentId,
  locked,
  initial,
}: {
  assignmentId: string;
  locked: boolean;
  initial: Scores & { bestValue: string; topImprovement: string };
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Scores>({
    problemDefinition: initial.problemDefinition,
    originality: initial.originality,
    closedLoop: initial.closedLoop,
    evidence: initial.evidence,
  });
  const [bestValue, setBestValue] = useState(initial.bestValue);
  const [topImprovement, setTopImprovement] = useState(initial.topImprovement);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const total = scores.problemDefinition + scores.originality + scores.closedLoop + scores.evidence;

  async function save(lock: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/judge/reviews/${assignmentId}`, {
      method: lock ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scores, bestValue, topImprovement }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "err", text: json.error ?? (lock ? "提交失败" : "保存失败") });
      return;
    }
    setMsg({ kind: "ok", text: lock ? "评分已锁定" : "草稿已保存" });
    if (lock) router.refresh();
  }

  return (
    <Card title="四维40分评分">
      {locked && (
        <div className="mb-4 flex items-center gap-3.5">
          <SuccessMark size={44} label="评分已锁定" />
          <Alert tone="success" title="评分已锁定" >
            锁定后不可修改;如需调整请联系组织者。
          </Alert>
        </div>
      )}
      <div className="space-y-5">
        {DIMENSIONS.map((d) => {
          const value = scores[d.key];
          return (
            <div key={d.key}>
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-800">{d.label}</p>
                  <p className="mt-0.5 text-xs leading-4 text-ink-400">{d.desc}</p>
                </div>
                <p className="shrink-0 text-right">
                  <span className="font-display tnum text-xl font-bold leading-6 text-brand-600">
                    {value}
                  </span>
                  <span className="tnum text-xs text-ink-400">/10</span>
                </p>
              </div>
              <div className="mt-1.5 flex items-center gap-2.5">
                <span aria-hidden className="tnum text-[10px] text-ink-500">0</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  disabled={locked}
                  value={value}
                  aria-label={d.label}
                  aria-valuetext={`${value}/10`}
                  onChange={(e) => setScores({ ...scores, [d.key]: Number(e.target.value) })}
                  style={{
                    background: `linear-gradient(to right, #b94a26 ${value * 10}%, #e8e6e0 ${value * 10}%) center / 100% 6px no-repeat`,
                  }}
                  className={rangeClass}
                />
                <span aria-hidden className="tnum text-[10px] text-ink-500">10</span>
              </div>
            </div>
          );
        })}

        {/* 总分:唯一大数字焦点,实时朗读 */}
        <div className="flex items-baseline justify-between border-t border-ink-900/10 pt-4" aria-live="polite">
          <span className="text-micro font-bold uppercase tracking-[0.28em] text-ink-500">总分</span>
          <p>
            <span className="font-display tnum text-[34px] font-bold leading-none tracking-tight text-ink-900">
              {total}
            </span>
            <span className="tnum text-sm text-ink-400">/40</span>
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-800">最大价值</span>
            <Textarea
              rows={2}
              disabled={locked}
              value={bestValue}
              onChange={(e) => setBestValue(e.target.value)}
              placeholder="这个作品最有价值的一点是什么"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink-800">首要改进</span>
            <Textarea
              rows={2}
              disabled={locked}
              value={topImprovement}
              onChange={(e) => setTopImprovement(e.target.value)}
              placeholder="如果只改一件事,应该改什么"
            />
          </label>
        </div>

        {!locked && (
          <div>
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={() => save(false)} loading={busy}>
                保存草稿
              </Button>
              <Button
                onClick={() => save(true)}
                loading={busy}
                disabled={!bestValue.trim() || !topImprovement.trim()}
              >
                提交并锁定
              </Button>
            </div>
            {(!bestValue.trim() || !topImprovement.trim()) && (
              <p className="mt-2 text-xs leading-5 text-ink-500">
                填写「最大价值」与「首要改进」后即可提交并锁定;锁定后不可修改。
              </p>
            )}
          </div>
        )}

        {msg?.kind === "err" && (
          <Alert tone="error">{msg.text}</Alert>
        )}
        {msg?.kind === "ok" && !locked && (
          <p role="status" className="flex items-center gap-1.5 text-xs text-emerald-700">
            <svg aria-hidden className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {msg.text}
          </p>
        )}
      </div>
    </Card>
  );
}

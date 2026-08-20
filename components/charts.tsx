"use client";

// 编辑风数据图:四维雷达(墨线+朱砂面)与任务里程碑条

import { Check } from "lucide-react";
import { cn } from "./ui";

export function Radar({
  values,
  labels,
  size = 190,
}: {
  values: number[]; // 0-10
  labels: string[];
  size?: number;
}) {
  const n = values.length;
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 30;
  const pt = (i: number, r: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };
  const ring = (frac: number) =>
    Array.from({ length: n }, (_, i) => pt(i, R * frac).join(",")).join(" ");
  const dataPoly = values.map((v, i) => pt(i, (Math.max(0, Math.min(10, v)) / 10) * R).join(",")).join(" ");
  const axisLabelPos = (i: number) => {
    const [x, y] = pt(i, R + 16);
    return { x, y };
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto motion-safe:animate-scale-in"
      role="img"
      aria-label="四维雷达图"
    >
      <defs>
        <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(185,74,38,0.26)" />
          <stop offset="100%" stopColor="rgba(160,62,32,0.10)" />
        </linearGradient>
      </defs>
      {/* 制图网格:hairline 细环 + 虚线内环 */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke={f === 1 ? "rgba(28,25,23,0.2)" : "rgba(28,25,23,0.09)"}
          strokeWidth={f === 1 ? 1.1 : 0.7}
          strokeDasharray={f === 1 ? undefined : "2 4"}
        />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(28,25,23,0.09)" strokeWidth="0.7" />;
      })}
      {/* 数据面:朱砂渐变 + 墨描边 */}
      <polygon points={dataPoly} fill="url(#radarFill)" stroke="#a03e20" strokeWidth="1.6" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, (Math.max(0, Math.min(10, v)) / 10) * R);
        return <circle key={i} cx={x} cy={y} r="3" fill="#a03e20" stroke="#fffdf8" strokeWidth="1.5" />;
      })}
      {labels.map((l, i) => {
        const { x, y } = axisLabelPos(i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10.5" fill="#6b6457" letterSpacing="0.04em">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

/** 任务里程碑条:已完成(盖章)→ 当前(朱砂点亮)→ 未开始(墨稿)的空间叙事 */
export function MissionBar({ phases, className }: { phases: { label: string; done: boolean; hint?: string }[]; className?: string }) {
  const currentIdx = phases.findIndex((p) => !p.done);
  return (
    <div className={cn("flex max-w-full items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)} role="list" aria-label="任务里程碑">
      {phases.map((p, i) => {
        const isCurrent = i === currentIdx;
        return (
          <div key={p.label} className="flex shrink-0 items-center gap-1" role="listitem">
            <span
              title={p.hint ?? p.label}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150",
                p.done
                  ? "border-emerald-600/25 bg-emerald-50/80 text-emerald-800"
                  : isCurrent
                    ? "border-brand-300 bg-brand-50 text-brand-700 shadow-[0_1px_2px_rgba(160,62,32,0.12)]"
                    : "border-ink-900/10 bg-[#fffdf8] text-ink-400"
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                  p.done ? "bg-emerald-600 text-white" : isCurrent ? "bg-brand-500 text-paper" : "bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-900/10"
                )}
              >
                {p.done ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden /> : <span className="tnum">{i + 1}</span>}
              </span>
              {p.label}
            </span>
            {i < phases.length - 1 && (
              <span className={cn("h-px w-4 shrink-0 transition-colors duration-300", p.done ? "bg-emerald-500/50" : "bg-ink-900/15")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

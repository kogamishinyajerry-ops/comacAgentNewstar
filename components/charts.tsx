"use client";

// 编辑风数据图:四维雷达(墨线+朱砂面)与任务里程碑条

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
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto" role="img" aria-label="四维雷达图">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="rgba(28,25,23,0.12)" strokeWidth={f === 1 ? 1.2 : 0.7} strokeDasharray={f === 1 ? undefined : "2 3"} />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(28,25,23,0.12)" strokeWidth="0.7" />;
      })}
      <polygon points={dataPoly} fill="rgba(185,74,38,0.18)" stroke="#a03e20" strokeWidth="1.6" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = pt(i, (Math.max(0, Math.min(10, v)) / 10) * R);
        return <circle key={i} cx={x} cy={y} r="2.6" fill="#a03e20" />;
      })}
      {labels.map((l, i) => {
        const { x, y } = axisLabelPos(i);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#6b6457">
            {l}
          </text>
        );
      })}
    </svg>
  );
}

/** 任务里程碑条:真问题 → 求证闭环 → 测试证据 → 交付 */
export function MissionBar({ phases, className }: { phases: { label: string; done: boolean; hint?: string }[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {phases.map((p, i) => (
        <div key={p.label} className="flex items-center gap-1">
          <span
            title={p.hint ?? p.label}
            className={cn(
              "flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
              p.done ? "border-emerald-600/30 bg-emerald-50 text-emerald-800" : "border-ink-900/15 bg-[#fffdf8] text-ink-400"
            )}
          >
            <span className={cn("flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold", p.done ? "bg-emerald-600 text-white" : "bg-ink-200 text-ink-500")}>
              {p.done ? "✓" : i + 1}
            </span>
            {p.label}
          </span>
          {i < phases.length - 1 && <span className={cn("h-px w-4", p.done ? "bg-emerald-500/50" : "bg-ink-900/15")} />}
        </div>
      ))}
    </div>
  );
}

import type { CoachVisualState } from "@/lib/hub/coach-machine";

export const COACH_STATE_LABELS: Record<CoachVisualState, string> = {
  idle: "静候",
  listening: "倾听",
  challenging: "质询",
  condensing: "凝结",
  confirmed: "已确认",
};

interface CoachOrbProps {
  state: CoachVisualState;
  /** 同页多枚光核时避免 SVG 渐变 id 冲突 */
  idPrefix?: string;
  size?: number;
  className?: string;
  /** 装饰性图形默认对辅助技术隐藏;语义由场景文字与 aria-live 承担 */
  decorative?: boolean;
}

/**
 * 抽象 AI Coach 光核:中央柔和光源 + 三层半透明薄膜轨迹 + 极少量方向线。
 * 状态由 data-state 驱动(见 tokens.css);不旋转、不漂浮、不持续闪烁。
 */
export function CoachOrb({
  state,
  idPrefix = "coach",
  size = 220,
  className = "",
  decorative = true,
}: CoachOrbProps) {
  return (
    <svg
      viewBox="0 0 320 320"
      width={size}
      height={size}
      className={`coach-orb ${className}`}
      data-state={state}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `AI Coach 光核:${COACH_STATE_LABELS[state]}`}
      focusable="false"
    >
      <defs>
        <radialGradient id={`${idPrefix}-core`} cx="46%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#bcd0ff" />
          <stop offset="38%" stopColor="#6f92f2" />
          <stop offset="100%" stopColor="#2b55c9" />
        </radialGradient>
        <radialGradient id={`${idPrefix}-core-challenge`} cx="46%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#d7cdff" />
          <stop offset="42%" stopColor="#9b86ef" />
          <stop offset="100%" stopColor="#7c62e8" />
        </radialGradient>
        <filter id={`${idPrefix}-soften`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      {/* 柔和晕影(不参与状态变化) */}
      <circle cx="160" cy="160" r="118" fill="#3568e8" opacity="0.07" filter={`url(#${idPrefix}-soften)`} />

      {/* 三层半透明薄膜轨迹 */}
      <g fill="none" strokeWidth="1.4">
        <ellipse
          className="orb-film orb-film-1"
          cx="160" cy="160" rx="128" ry="88"
          stroke="#3568e8"
        />
        <ellipse
          className="orb-film orb-film-2"
          cx="160" cy="160" rx="112" ry="72"
          stroke="#3568e8"
          transform="rotate(-8 160 160)"
        />
        <ellipse
          className="orb-film orb-film-3"
          cx="160" cy="160" rx="96" ry="58"
          stroke="#7c62e8"
          transform="rotate(5 160 160)"
        />
      </g>

      {/* 极少量方向线 */}
      <g strokeWidth="1.6" strokeLinecap="round" stroke="#3568e8">
        <line className="orb-line" x1="160" y1="34" x2="160" y2="58" />
        <line className="orb-line" x1="42" y1="196" x2="66" y2="184" />
        <line className="orb-line" x1="278" y1="124" x2="254" y2="136" />
      </g>

      {/* 中央光核 */}
      <circle className="orb-core" cx="160" cy="160" r="62" fill={`url(#${idPrefix}-core)`} />
      <circle cx="140" cy="140" r="18" fill="#ffffff" opacity="0.28" filter={`url(#${idPrefix}-soften)`} />
    </svg>
  );
}

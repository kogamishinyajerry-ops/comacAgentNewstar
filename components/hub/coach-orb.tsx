import Image from "next/image";
import type { CoachVisualState } from "@/lib/hub/coach-machine";

export const COACH_STATE_LABELS: Record<CoachVisualState, string> = {
  idle: "静候",
  listening: "倾听",
  challenging: "质询",
  condensing: "凝结",
  confirmed: "已确认",
};

export const COACH_STATE_ART: Record<CoachVisualState, string> = {
  idle: "/hub/art/coach-state-idle.webp",
  listening: "/hub/art/coach-state-listening.webp",
  challenging: "/hub/art/coach-state-challenging.webp",
  condensing: "/hub/art/coach-state-condensing.webp",
  confirmed: "/hub/art/coach-state-confirmed.webp",
};

interface CoachOrbProps {
  state: CoachVisualState;
  /** 同页多枚状态标记的稳定标识；保留既有调用接口。 */
  idPrefix?: string;
  size?: number;
  className?: string;
  /** 装饰性图形默认对辅助技术隐藏；语义由场景文字与 aria-live 承担。 */
  decorative?: boolean;
}

/**
 * AI Coach 平面状态标记。
 * 五张真实平面插画分别表达状态，不再用同一资产假装变化。
 */
export function CoachOrb({
  state,
  idPrefix = "coach",
  size = 220,
  className = "",
  decorative = true,
}: CoachOrbProps) {
  return (
    <div
      className={`coach-orb ${className}`}
      data-state={state}
      data-coach-mark={idPrefix}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `AI Coach 平面状态标记:${COACH_STATE_LABELS[state]}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={COACH_STATE_ART[state]}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="coach-orb-layer coach-orb-layer--main"
        data-coach-art="flat"
        draggable={false}
        priority={idPrefix.startsWith("hero") || idPrefix.startsWith("workbench")}
        unoptimized
      />
    </div>
  );
}

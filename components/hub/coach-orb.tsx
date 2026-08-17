import Image from "next/image";
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
  /** 同页多枚状态标记的稳定标识；保留既有调用接口。 */
  idPrefix?: string;
  size?: number;
  className?: string;
  /** 装饰性图形默认对辅助技术隐藏；语义由场景文字与 aria-live 承担。 */
  decorative?: boolean;
}

/**
 * AI Coach 平面状态标记。
 * 两层真实插画资产通过轻微套色错位表达状态，不再模拟球体、体积光或玻璃材质。
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
        src="/hub/art/flat-coach-field.png"
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="coach-orb-layer coach-orb-layer--echo"
        draggable={false}
        unoptimized
      />
      <Image
        src="/hub/art/flat-coach-field.png"
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        className="coach-orb-layer coach-orb-layer--main"
        data-coach-art="flat"
        draggable={false}
        priority={idPrefix.startsWith("hero")}
        unoptimized
      />
    </div>
  );
}

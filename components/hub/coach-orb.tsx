import type { CoachVisualState } from "@/lib/hub/coach-machine";

export const COACH_STATE_LABELS: Record<CoachVisualState, string> = {
  idle: "静候",
  listening: "倾听",
  challenging: "质询",
  condensing: "凝结",
  confirmed: "已确认",
};

/** 场景切换与 tokens.css --dur-scene 一致;层间过渡只解释状态变化,不新增循环动画 */
const LAYER_TRANSITION =
  "transition-[transform,opacity,border-color,box-shadow] duration-[540ms] ease-soft";

/* 五态的纯代码表达:光晕 / 外环 / 弧环 / 刻线环 / 核心 / 勾选。
   每态一张静态"画面",态间由过渡曲线衔接;reduced-motion 下过渡被
   tokens.css 全局停用,静态画面依然各自成立。 */
const HALO_CLASSES: Record<CoachVisualState, string> = {
  idle: "scale-90 opacity-0",
  listening: "scale-100 opacity-100",
  challenging: "scale-75 opacity-0",
  condensing: "scale-[0.68] opacity-90",
  confirmed: "scale-100 opacity-60",
};
const OUTER_RING_CLASSES: Record<CoachVisualState, string> = {
  idle: "scale-100 border-navy-300/50",
  listening: "scale-100 border-cobalt-500/60",
  challenging: "scale-[0.96] border-cobalt-600/80",
  condensing: "scale-[0.8] border-cobalt-600/80",
  confirmed: "scale-100 border-cobalt-600",
};
/** 钴蓝弧环:倾听=开放的一段弧,凝结=即将闭合的弧,确认=完整闭环 */
const ARC_RING_CLASSES: Record<CoachVisualState, string> = {
  idle: "scale-105 opacity-0",
  listening: "scale-100 opacity-100",
  challenging: "scale-95 opacity-0",
  condensing: "scale-[0.88] opacity-100",
  confirmed: "scale-100 opacity-100",
};
const ARC_RING_BACKGROUNDS: Record<CoachVisualState, string> = {
  idle: "bg-[conic-gradient(rgba(43,85,201,0.85)_0deg_110deg,transparent_110deg_360deg)]",
  listening:
    "bg-[conic-gradient(rgba(43,85,201,0.85)_0deg_110deg,transparent_110deg_360deg)]",
  challenging:
    "bg-[conic-gradient(rgba(43,85,201,0.85)_0deg_110deg,transparent_110deg_360deg)]",
  condensing:
    "bg-[conic-gradient(rgba(43,85,201,0.9)_0deg_315deg,transparent_315deg_360deg)]",
  confirmed: "bg-[conic-gradient(rgba(43,85,201,1)_0deg_360deg,transparent_0deg)]",
};
/** 海军蓝刻线环:质询态的"聚焦刻度",四枚 8° 刻线 */
const TICK_RING_CLASSES: Record<CoachVisualState, string> = {
  idle: "rotate-0 opacity-0",
  listening: "rotate-0 opacity-0",
  challenging: "rotate-45 opacity-100",
  condensing: "rotate-90 opacity-0",
  confirmed: "rotate-90 opacity-0",
};
const TICK_RING_BACKGROUND =
  "bg-[conic-gradient(rgba(23,34,56,0.6)_0deg_8deg,transparent_8deg_90deg,rgba(23,34,56,0.6)_90deg_98deg,transparent_98deg_180deg,rgba(23,34,56,0.6)_180deg_188deg,transparent_188deg_270deg,rgba(23,34,56,0.6)_270deg_278deg,transparent_278deg_360deg)]";
const CORE_CLASSES: Record<CoachVisualState, string> = {
  idle: "scale-[0.82] opacity-60",
  listening: "scale-100 opacity-100",
  challenging: "scale-[0.7] opacity-100",
  condensing: "scale-[1.14] opacity-100",
  confirmed: "scale-100 opacity-100",
};
const CHECK_CLASSES: Record<CoachVisualState, string> = {
  idle: "opacity-0 [clip-path:inset(0_100%_100%_0)]",
  listening: "opacity-0 [clip-path:inset(0_100%_100%_0)]",
  challenging: "opacity-0 [clip-path:inset(0_100%_100%_0)]",
  condensing: "opacity-0 [clip-path:inset(0_100%_100%_0)]",
  confirmed: "opacity-100 delay-150 [clip-path:inset(0_0_0_0)]",
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
 * AI Coach 状态标记(2026-08-20 视觉升级:纯代码五态)。
 * 状态表达由代码绘制的光晕/环/弧/刻线/核心/勾选承担,不依赖任何插画素材;
 * 圆形元素一律用 span + border-radius/conic-gradient 绘制:.coach-orb 内不出现 svg/img。
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
      aria-label={decorative ? undefined : `AI Coach 状态标记:${COACH_STATE_LABELS[state]}`}
      style={{ width: size, height: size }}
    >
      {/* 钴蓝环境光晕:倾听时展开,凝结时向核心收拢 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[6%] rounded-full bg-[radial-gradient(closest-side,rgba(43,85,201,0.2),transparent)] ${LAYER_TRANSITION} ${HALO_CLASSES[state]}`}
      />
      {/* 外环:状态的外轮廓;凝结时向内收缩 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[4%] rounded-full border ${LAYER_TRANSITION} ${OUTER_RING_CLASSES[state]}`}
      />
      {/* 钴蓝弧环( donut 遮罩):开放弧 → 将闭合 → 完整闭环 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[15%] rounded-full [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2px))] [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),#000_calc(100%-2px))] ${LAYER_TRANSITION} ${ARC_RING_BACKGROUNDS[state]} ${ARC_RING_CLASSES[state]}`}
      />
      {/* 质询刻线环:海军蓝四刻度,质询态淡入并转正 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[15%] rounded-full [-webkit-mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-3px))] [mask:radial-gradient(farthest-side,transparent_calc(100%-4px),#000_calc(100%-3px))] ${LAYER_TRANSITION} ${TICK_RING_BACKGROUND} ${TICK_RING_CLASSES[state]}`}
      />
      {/* 核心:平色同心圆盘(硬停径向层次,无偏心高光、无投影),
          倾听饱满、质询收缩成锐点、凝结最亮 */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[38%] rounded-full bg-[radial-gradient(circle,#3a63d4_0%,#3a63d4_42%,#2b55c9_42%,#2b55c9_100%)] ${LAYER_TRANSITION} ${CORE_CLASSES[state]}`}
      >
        {/* 确认勾选:边框绘制的 ✓,确认态以 clip-path 一次画完 */}
        <span
          aria-hidden="true"
          className={`absolute left-[31%] top-[18%] h-[36%] w-[22%] rotate-45 rounded-[1px] border-b-2 border-r-2 border-white transition-[opacity,clip-path] duration-300 ease-soft ${CHECK_CLASSES[state]}`}
        />
      </span>
    </div>
  );
}

import { cn } from "./ui";

/** 印章标识:朱红方印 + 「解」——全站签名符号
    材质:朱砂微渐变 + inset 高光 + 内圈纸色细线 + 层叠柔影,纯 CSS 绘制 */
export function Seal({ size = 32, char = "解", className, tilt }: { size?: number; char?: string; className?: string; tilt?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center justify-center rounded-[6px] text-paper",
        "bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600",
        "shadow-[0_1px_2px_rgba(124,47,24,0.3),0_6px_16px_-4px_rgba(124,47,24,0.4),inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_1px_rgba(124,47,24,0.35)]",
        tilt && "rotate-[-4deg]",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="font-display font-bold leading-none [text-shadow:0_1px_1px_rgba(124,47,24,0.45)]"
        style={{ fontSize: size * 0.56, paddingBottom: size * 0.04 }}
      >
        {char.slice(0, 1)}
      </span>
      <span className="pointer-events-none absolute inset-[2.5px] rounded-[3px] border border-paper/55" />
    </span>
  );
}

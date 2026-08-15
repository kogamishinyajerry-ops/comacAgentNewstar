import { cn } from "./ui";

/** 印章标识:朱红方印 + 「解」——全站签名符号 */
export function Seal({ size = 32, char = "解", className, tilt }: { size?: number; char?: string; className?: string; tilt?: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center justify-center rounded-[6px] bg-brand-600 text-paper shadow-[0_2px_8px_rgba(124,47,24,0.35)]",
        tilt && "rotate-[-4deg]",
        className
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="font-display font-bold leading-none"
        style={{ fontSize: size * 0.56, paddingBottom: size * 0.04 }}
      >
        {char.slice(0, 1)}
      </span>
      <span className="pointer-events-none absolute inset-[2.5px] rounded-[3px] border border-paper/50" />
    </span>
  );
}

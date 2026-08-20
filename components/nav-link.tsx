"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

/**
 * 顶部导航条目(设计系统 v2,2026-08-20 Act 5)
 * - 当前位置双编码:朱砂浅底文字 + 底部 2px 描线下划线,永不迷路;
 * - 下划线用 scaleX 微动效展开(reduced-motion 下为即时呈现);
 * - hover / active / focus-visible 三态齐全(props 契约不变)。
 */
export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center rounded-md px-3 text-[13px] font-medium",
        "transition-colors duration-150 ease-soft",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-paper",
        active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-ink-100/80 hover:text-ink-900 active:scale-[0.98]"
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-3 -bottom-[7px] h-[2px] origin-left rounded-full bg-brand-600",
          "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-soft",
          active ? "scale-x-100" : "scale-x-0"
        )}
      />
    </Link>
  );
}

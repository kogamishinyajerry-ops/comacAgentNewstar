"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Drawer } from "./fx";
import { NavLink } from "./nav-link";

/**
 * 移动端导航(设计系统 v2,2026-08-20 视觉走查修复 P0)
 * - <md 顶栏无导航可达:汉堡按钮(≥44px 触控目标)+ fx.tsx Drawer
 *   (自带 Esc 关闭与焦点管理/归还);
 * - 菜单项复用 NavLink 的 active 双编码(朱砂浅底 + 2px 描线),路由变化自动收起;
 * - 未登录态补上「登录 / 注册参与」的 active 标记(视觉走查 P2⑥)。
 */
export function MobileNav({
  role,
  pendingConfirm = 0,
}: {
  role?: "PARTICIPANT" | "ORGANIZER" | "JUDGE" | "ADMIN";
  pendingConfirm?: number;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMounted(true), []);

  // 路由变化即收起抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* 抽屉 portal 到 body:header 的 backdrop-filter 会把 fixed 后代的
     包含块改写成 header,抽屉会被压扁在 64px 顶栏内 */
  const drawer = (
    <Drawer open={open} onClose={() => setOpen(false)} side="left" title="导航">
      <nav aria-label="移动端导航" className="flex flex-col items-stretch gap-1">
        {role && (role === "PARTICIPANT" || role === "ADMIN") && (
          <NavLink href="/projects">我的实践</NavLink>
        )}
        {(role === "ORGANIZER" || role === "ADMIN") && (
          <NavLink href="/organizer">组织者</NavLink>
        )}
        {(role === "ORGANIZER" || role === "ADMIN") && (
          <span className="relative">
            <NavLink href="/workbuddy">WorkBuddy</NavLink>
            {pendingConfirm > 0 && (
              <span className="tnum pointer-events-none absolute right-3 top-1/2 flex h-4 min-w-4 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-paper">
                {pendingConfirm > 9 ? "9+" : pendingConfirm}
              </span>
            )}
          </span>
        )}
        {role === "JUDGE" && <NavLink href="/judge">评委工作台</NavLink>}
        <span className="my-1.5 h-px bg-ink-900/10" aria-hidden />
        <NavLink href="/inspirations">案例灵感</NavLink>
        <NavLink href="/announcements">公告</NavLink>
        <NavLink href="/office-hours">Office Hour</NavLink>
        {!role && (
          <>
            <span className="my-1.5 h-px bg-ink-900/10" aria-hidden />
            <NavLink href="/login" exact>
              登录
            </NavLink>
            <NavLink href="/register" exact>
              注册参与
            </NavLink>
          </>
        )}
      </nav>
      <p className="mt-auto pt-4 text-[11px] leading-4 text-ink-300">
        从真实问题出发，用证据完成作品
      </p>
    </Drawer>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="打开导航菜单"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-ink-100/80 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-paper active:scale-[0.96]"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      {mounted && createPortal(drawer, document.body)}
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";
import { Seal } from "./seal";

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notice.count({ where: { userId: user.id, readAt: null } }) : 0;
  const pendingConfirm =
    user && (user.role === "ORGANIZER" || user.role === "ADMIN")
      ? await prisma.pendingAction.count({ where: { status: "PENDING" } })
      : 0;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-900/10 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Seal size={30} tilt />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-[15px] font-bold tracking-wide text-ink-900">青年AI轻创导航站</span>
            <span className="text-[10px] tracking-[0.14em] text-ink-400">发现一个真问题,做一个可验证的解法</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {user && (user.role === "PARTICIPANT" || user.role === "ADMIN") && (
            <NavLink href="/projects">我的工作台</NavLink>
          )}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && <NavLink href="/organizer">组织者</NavLink>}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && (
            <span className="relative">
              <NavLink href="/workbuddy">WorkBuddy</NavLink>
              {pendingConfirm > 0 && (
                <span className="tnum pointer-events-none absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-paper ring-2 ring-paper">
                  {pendingConfirm > 9 ? "9+" : pendingConfirm}
                </span>
              )}
            </span>
          )}
          {user?.role === "JUDGE" && <NavLink href="/judge">评委工作台</NavLink>}
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <NavLink href="/inspirations">案例灵感</NavLink>
          <NavLink href="/announcements">公告</NavLink>
          <NavLink href="/office-hours">Office Hour</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {user ? (
            <>
              <Link href="/notices" className="relative flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800" title="站内通知">
                <svg className="h-[17px] w-[17px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M10 2.5a4.6 4.6 0 0 0-4.6 4.6v2.6l-1.2 2.6a.6.6 0 0 0 .55.85h10.5a.6.6 0 0 0 .55-.85l-1.2-2.6V7.1A4.6 4.6 0 0 0 10 2.5Z" strokeLinejoin="round" />
                  <path d="M8.2 15.6a1.9 1.9 0 0 0 3.6 0" strokeLinecap="round" />
                </svg>
                {unread > 0 && (
                  <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-paper ring-2 ring-paper">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-ink-900/15 bg-[#fffdf8] py-1 pl-1 pr-2.5 sm:inline-flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 font-display text-[11px] font-bold text-paper">
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-xs font-medium text-ink-800">{user.name}</span>
                <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] text-ink-500">{ROLE_LABELS[user.role]}</span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-[13px] font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900">登录</Link>
              <Link href="/register" className="inline-flex h-8 items-center rounded-md bg-ink-900 px-3.5 text-[13px] font-medium text-paper transition-colors hover:bg-ink-800">注册参与</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

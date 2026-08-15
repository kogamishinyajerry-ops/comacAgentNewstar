import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "./logout-button";
import { NavLink } from "./nav-link";

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notice.count({ where: { userId: user.id, readAt: null } }) : 0;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-5 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-bold text-white shadow-[0_2px_6px_rgba(79,70,229,0.35)]">
            AI
          </span>
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="text-[14px] font-semibold tracking-tight text-slate-900">青年AI轻创导航站</span>
            <span className="text-[10px] text-slate-400">发现一个真问题,做一个可验证的解法</span>
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {user && (user.role === "PARTICIPANT" || user.role === "ADMIN") && (
            <NavLink href="/projects">我的工作台</NavLink>
          )}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && <NavLink href="/organizer">组织者</NavLink>}
          {user?.role === "JUDGE" && <NavLink href="/judge">评委工作台</NavLink>}
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden />
          <NavLink href="/inspirations">案例灵感</NavLink>
          <NavLink href="/announcements">公告</NavLink>
          <NavLink href="/office-hours">Office Hour</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {user ? (
            <>
              <Link href="/notices" className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" title="站内通知">
                <svg className="h-[17px] w-[17px]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M10 2.5a4.6 4.6 0 0 0-4.6 4.6v2.6l-1.2 2.6a.6.6 0 0 0 .55.85h10.5a.6.6 0 0 0 .55-.85l-1.2-2.6V7.1A4.6 4.6 0 0 0 10 2.5Z" strokeLinejoin="round" />
                  <path d="M8.2 15.6a1.9 1.9 0 0 0 3.6 0" strokeLinecap="round" />
                </svg>
                {unread > 0 && (
                  <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5 sm:inline-flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-xs font-medium text-slate-700">{user.name}</span>
                <span className="rounded bg-slate-100 px-1.5 py-px text-[10px] text-slate-500">{ROLE_LABELS[user.role]}</span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-md px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">登录</Link>
              <Link href="/register" className="inline-flex h-8 items-center rounded-md bg-brand-600 px-3.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(79,70,229,0.35)] transition-colors hover:bg-brand-700">注册参与</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

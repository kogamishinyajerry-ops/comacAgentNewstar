import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { site } from "@/config/site";
import { LinkButton } from "./ui";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./nav-mobile";
import { NavLink } from "./nav-link";
import { Seal } from "./seal";

/** 未读/待办计数徽标:朱砂圆点 + tabular 数字,>9 收敛为 9+ */
function CountBadge({ n }: { n: number }) {
  return (
    <span className="tnum pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-paper shadow-[0_1px_3px_rgba(124,47,24,0.4)] ring-2 ring-paper">
      {n > 9 ? "9+" : n}
    </span>
  );
}

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user
    ? await prisma.notice.count({ where: { userId: user.id, readAt: null } })
    : 0;
  const pendingConfirm =
    user && (user.role === "ORGANIZER" || user.role === "ADMIN")
      ? await prisma.pendingAction.count({ where: { status: "PENDING" } })
      : 0;

  return (
    <header className="no-print sticky top-0 z-40 border-b border-ink-900/10 bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <MobileNav role={user?.role} pendingConfirm={pendingConfirm} />
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <Seal size={32} tilt className="transition-transform duration-200 ease-spring group-hover:rotate-[-7deg]" />
          <span className="hidden flex-col leading-tight sm:flex">
            <span className="font-display text-[15px] font-bold tracking-wide text-ink-900">
              {site.brand.shortName}
            </span>
            <span className="mt-px text-[10px] tracking-[0.16em] text-ink-400">
              从真实问题出发，用证据完成作品
            </span>
          </span>
        </Link>

        <nav aria-label="主导航" className="hidden flex-1 items-center gap-1 md:flex">
          {user && (user.role === "PARTICIPANT" || user.role === "ADMIN") && (
            <NavLink href="/projects">我的实践</NavLink>
          )}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && (
            <NavLink href="/organizer">组织者</NavLink>
          )}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && (
            <span className="relative">
              <NavLink href="/workbuddy">WorkBuddy</NavLink>
              {pendingConfirm > 0 && <CountBadge n={pendingConfirm} />}
            </span>
          )}
          {user?.role === "JUDGE" && <NavLink href="/judge">评委工作台</NavLink>}
          <span className="mx-1.5 h-4 w-px bg-ink-900/10" aria-hidden />
          <NavLink href="/inspirations">案例灵感</NavLink>
          <NavLink href="/announcements">公告</NavLink>
          <NavLink href="/office-hours">Office Hour</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {user ? (
            <>
              <Link
                href="/notices"
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-500 transition-colors duration-150 hover:bg-ink-100/80 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-paper active:scale-[0.96]"
                title="站内通知"
                aria-label={unread > 0 ? `站内通知,${unread} 条未读` : "站内通知"}
              >
                <svg
                  className="h-[18px] w-[18px]"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  <path
                    d="M10 2.5a4.6 4.6 0 0 0-4.6 4.6v2.6l-1.2 2.6a.6.6 0 0 0 .55.85h10.5a.6.6 0 0 0 .55-.85l-1.2-2.6V7.1A4.6 4.6 0 0 0 10 2.5Z"
                    strokeLinejoin="round"
                  />
                  <path d="M8.2 15.6a1.9 1.9 0 0 0 3.6 0" strokeLinecap="round" />
                </svg>
                {unread > 0 && <CountBadge n={unread} />}
              </Link>
              <span className="hidden items-center gap-2 rounded-full border border-ink-900/10 bg-[#fffdf8] py-1 pl-1 pr-3 shadow-[0_1px_2px_rgba(28,25,23,0.05)] sm:inline-flex">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 font-display text-[11px] font-bold text-paper">
                  {user.name.slice(0, 1)}
                </span>
                <span className="text-xs font-medium text-ink-800">{user.name}</span>
                <span className="rounded bg-ink-100 px-1.5 py-px text-[10px] font-medium tracking-wide text-ink-500">
                  {ROLE_LABELS[user.role]}
                </span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <span className="hidden sm:block">
                <NavLink href="/login" exact>
                  登录
                </NavLink>
              </span>
              <LinkButton href="/register" variant="primary" size="sm">
                注册参与
              </LinkButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

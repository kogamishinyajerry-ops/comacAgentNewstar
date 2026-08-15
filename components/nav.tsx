import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/constants";
import { LogoutButton } from "./logout-button";

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user ? await prisma.notice.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-brand-600 text-xs font-bold text-white">AI</span>
          青年AI轻创导航站
        </Link>
        <nav className="hidden flex-1 items-center gap-4 text-sm text-slate-600 md:flex">
          <Link href="/inspirations" className="hover:text-brand-600">案例灵感</Link>
          <Link href="/announcements" className="hover:text-brand-600">公告</Link>
          <Link href="/office-hours" className="hover:text-brand-600">Office Hour</Link>
          {user && (user.role === "PARTICIPANT" || user.role === "ADMIN") && (
            <Link href="/projects" className="hover:text-brand-600">我的工作台</Link>
          )}
          {(user?.role === "ORGANIZER" || user?.role === "ADMIN") && (
            <Link href="/organizer" className="hover:text-brand-600">组织者</Link>
          )}
          {user?.role === "JUDGE" && <Link href="/judge" className="hover:text-brand-600">评委工作台</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href="/notices" className="relative rounded px-1.5 py-0.5 hover:bg-slate-100" title="站内通知">
                🔔
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <span className="hidden text-slate-500 sm:inline">
                {user.name}({ROLE_LABELS[user.role]})
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="text-brand-600 hover:underline">登录</Link>
              <Link href="/register" className="rounded bg-brand-600 px-3 py-1.5 text-white hover:bg-brand-700">注册</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

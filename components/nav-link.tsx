"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={
        "relative flex h-8 items-center rounded-md px-2.5 text-[13px] font-medium transition-colors " +
        (active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
      }
    >
      {children}
      {active && <span className="absolute inset-x-2.5 -bottom-[9px] h-[2px] rounded-full bg-brand-600" />}
    </Link>
  );
}

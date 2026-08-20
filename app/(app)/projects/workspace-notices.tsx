"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge, cn } from "@/components/ui";

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

/** 通知列表:点击即标记已读并跳转(可返回) */
export function NoticeList({ initial }: { initial: NoticeItem[] }) {
  const [items, setItems] = useState(initial);

  async function open(n: NoticeItem) {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      fetch(`/api/notices/${n.id}/read`, { method: "PATCH" }).catch(() => undefined);
    }
  }

  return (
    <ul className="space-y-2">
      {items.map((n) => (
        <li
          key={n.id}
          className={cn(
            "rounded-lg border p-3 text-sm transition-[border-color,background-color,box-shadow] duration-150",
            n.read
              ? "border-ink-900/10 bg-white"
              : "border-blue-200/90 bg-blue-50/70 shadow-[0_1px_2px_rgba(28,25,23,0.04)]"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-start gap-1.5 font-medium text-ink-800">
              {!n.read && (
                <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-label="未读" />
              )}
              {n.title}
            </p>
            <time className="tnum shrink-0 text-[11px] leading-5 text-ink-400">
              {new Date(n.createdAt).toLocaleString("zh-CN")}
            </time>
          </div>
          <p className="mt-1 text-xs leading-5 text-ink-500">{n.body}</p>
          {n.link && (
            <Link
              href={n.link}
              onClick={() => open(n)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline"
            >
              去处理
              <ArrowRight size={12} strokeWidth={2.2} aria-hidden />
            </Link>
          )}
        </li>
      ))}
      {items.length === 0 && (
        <li className="rounded-lg border border-dashed border-ink-900/15 p-6 text-center text-sm text-ink-400">
          暂无通知
        </li>
      )}
    </ul>
  );
}

/** 工作台侧栏精简版 */
export function WorkspaceNotices({ notices }: { notices: NoticeItem[] }) {
  const unread = notices.filter((n) => !n.read).length;
  return (
    <section className="surface-card p-4" aria-label="站内通知">
      <h3 className="flex items-center justify-between text-micro font-semibold uppercase text-ink-400">
        站内通知
        {unread > 0 && <Badge tone="blue">{unread} 条未读</Badge>}
      </h3>
      <div className="mt-2.5">
        <NoticeList initial={notices.slice(0, 3)} />
      </div>
      <Link
        href="/notices"
        className="mt-2.5 inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline"
      >
        全部通知
        <ArrowRight size={12} strokeWidth={2.2} aria-hidden />
      </Link>
    </section>
  );
}

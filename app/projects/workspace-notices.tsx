"use client";

import Link from "next/link";
import { useState } from "react";
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
            "rounded-md border p-3 text-sm transition",
            n.read ? "border-slate-100 bg-white" : "border-blue-200 bg-blue-50"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-slate-800">
              {!n.read && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-500 align-middle" />}
              {n.title}
            </p>
            <span className="shrink-0 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600">{n.body}</p>
          {n.link && (
            <Link href={n.link} onClick={() => open(n)} className="mt-1.5 inline-block text-xs font-medium text-brand-600 hover:underline">
              去处理 →
            </Link>
          )}
        </li>
      ))}
      {items.length === 0 && (
        <li className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="flex items-center justify-between text-sm font-semibold text-slate-700">
        站内通知
        {unread > 0 && <Badge tone="blue">{unread}条未读</Badge>}
      </h3>
      <div className="mt-2">
        <NoticeList initial={notices.slice(0, 3)} />
      </div>
      <Link href="/notices" className="mt-2 inline-block text-xs text-brand-600 hover:underline">全部通知 →</Link>
    </div>
  );
}

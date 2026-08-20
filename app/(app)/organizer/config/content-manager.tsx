"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, Field, Input, Textarea, cn } from "@/components/ui";
import { ConfirmModal } from "../confirm-modal";

type Kind = "announcement" | "inspiration" | "officeHour";

const KIND_LABEL: Record<Kind, string> = {
  announcement: "公告",
  inspiration: "案例",
  officeHour: "Office Hour",
};

function StatusMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p
      role="status"
      className={cn("flex items-center gap-1.5 text-xs font-medium lg:col-span-3", msg.ok ? "text-emerald-700" : "text-red-600")}
    >
      {msg.ok && (
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="8" cy="8" r="6.4" />
          <path d="m5.4 8.2 1.8 1.8 3.4-4" />
        </svg>
      )}
      {msg.text}
    </p>
  );
}

export function ContentManager({
  announcements,
  inspirations,
  officeHours,
}: {
  announcements: { id: string; title: string; body: string; pinned: boolean }[];
  inspirations: { id: string; title: string; summary: string; track: string | null; tags: string }[];
  officeHours: { id: string; title: string; host: string; time: string; place: string; capacity: number }[];
}) {
  const router = useRouter();
  const [ann, setAnn] = useState({ title: "", body: "" });
  const [ins, setIns] = useState({ title: "", summary: "", track: "", tags: "" });
  const [oh, setOh] = useState({ title: "", host: "", time: "", place: "", capacity: 20 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busyKind, setBusyKind] = useState<Kind | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ kind: Kind; id: string; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function create(kind: Kind, payload: Record<string, unknown>) {
    setBusyKind(kind);
    setMsg(null);
    const res = await fetch("/api/organizer/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyKind(null);
    setMsg({ ok: res.ok, text: res.ok ? "已发布" : json.error ?? "发布失败" });
    if (res.ok) router.refresh();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/organizer/content?kind=${pendingDelete.kind}&id=${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      setMsg({ ok: false, text: "删除失败" });
      return;
    }
    setPendingDelete(null);
    setMsg({ ok: true, text: "已删除" });
    router.refresh();
  }

  const listRow =
    "flex items-center justify-between gap-2 rounded-md border border-ink-900/10 bg-[#fffdf8] px-2.5 py-1.5 transition-colors duration-150 hover:border-ink-900/20";

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="公告管理">
        <div className="space-y-3">
          <Field label="标题" required>
            <Input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
          </Field>
          <Field label="正文" required>
            <Textarea rows={3} value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
          </Field>
          <Button size="sm" loading={busyKind === "announcement"} onClick={() => create("announcement", ann)}>发布公告</Button>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-ink-900/10 pt-3 text-xs">
          {announcements.map((a) => (
            <li key={a.id} className={listRow}>
              <span className="flex min-w-0 items-center gap-1.5">
                {a.pinned && <Badge tone="amber">置顶</Badge>}
                <span className="truncate text-ink-700">{a.title}</span>
              </span>
              <Button size="xs" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setPendingDelete({ kind: "announcement", id: a.id, label: a.title })}>
                删除
              </Button>
            </li>
          ))}
          {announcements.length === 0 && <li className="text-ink-500">暂无公告。</li>}
        </ul>
      </Card>

      <Card title="案例灵感库">
        <div className="space-y-3">
          <Field label="标题" required>
            <Input value={ins.title} onChange={(e) => setIns({ ...ins, title: e.target.value })} />
          </Field>
          <Field label="摘要" required>
            <Textarea rows={3} value={ins.summary} onChange={(e) => setIns({ ...ins, summary: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="赛道">
              <Input value={ins.track} onChange={(e) => setIns({ ...ins, track: e.target.value })} placeholder="如 process-automation" />
            </Field>
            <Field label="标签">
              <Input value={ins.tags} onChange={(e) => setIns({ ...ins, tags: e.target.value })} placeholder="逗号分隔" />
            </Field>
          </div>
          <Button size="sm" loading={busyKind === "inspiration"} onClick={() => create("inspiration", ins)}>发布案例</Button>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-ink-900/10 pt-3 text-xs">
          {inspirations.map((i) => (
            <li key={i.id} className={listRow}>
              <span className="truncate text-ink-700">{i.title}</span>
              <Button size="xs" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setPendingDelete({ kind: "inspiration", id: i.id, label: i.title })}>
                删除
              </Button>
            </li>
          ))}
          {inspirations.length === 0 && <li className="text-ink-500">暂无案例。</li>}
        </ul>
      </Card>

      <Card title="Office Hour">
        <div className="space-y-3">
          <Field label="主题" required>
            <Input value={oh.title} onChange={(e) => setOh({ ...oh, title: e.target.value })} />
          </Field>
          <Field label="主持人" required>
            <Input value={oh.host} onChange={(e) => setOh({ ...oh, host: e.target.value })} />
          </Field>
          <Field label="时间" required>
            <Input value={oh.time} onChange={(e) => setOh({ ...oh, time: e.target.value })} placeholder="每周三 19:30—21:00" />
          </Field>
          <Field label="地点/链接说明" required>
            <Input value={oh.place} onChange={(e) => setOh({ ...oh, place: e.target.value })} />
          </Field>
          <Field label="容量">
            <Input type="number" min={1} max={200} value={oh.capacity} onChange={(e) => setOh({ ...oh, capacity: Number(e.target.value) })} />
          </Field>
          <Button size="sm" loading={busyKind === "officeHour"} onClick={() => create("officeHour", oh)}>发布</Button>
        </div>
        <ul className="mt-3 space-y-1.5 border-t border-ink-900/10 pt-3 text-xs">
          {officeHours.map((o) => (
            <li key={o.id} className={listRow}>
              <span className="truncate text-ink-700">{o.title}</span>
              <Button size="xs" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setPendingDelete({ kind: "officeHour", id: o.id, label: o.title })}>
                删除
              </Button>
            </li>
          ))}
          {officeHours.length === 0 && <li className="text-ink-500">暂无排期。</li>}
        </ul>
      </Card>

      <StatusMsg msg={msg} />

      <ConfirmModal
        open={pendingDelete !== null}
        title={`删除该${pendingDelete ? KIND_LABEL[pendingDelete.kind] : "内容"}?`}
        desc={pendingDelete ? `「${pendingDelete.label}」将被永久删除,前台立即不可见。` : undefined}
        confirmLabel="确认删除"
        danger
        busy={deleting}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

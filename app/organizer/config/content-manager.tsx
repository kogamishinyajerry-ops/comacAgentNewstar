"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

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
  const [msg, setMsg] = useState("");

  async function create(kind: "announcement" | "inspiration" | "officeHour", payload: Record<string, unknown>) {
    const res = await fetch("/api/organizer/content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
    const json = await res.json().catch(() => ({}));
    setMsg(res.ok ? "已发布" : json.error ?? "发布失败");
    if (res.ok) router.refresh();
  }

  async function remove(kind: string, id: string) {
    if (!confirm("确认删除?")) return;
    const res = await fetch(`/api/organizer/content?kind=${kind}&id=${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="公告管理">
        <div className="space-y-2">
          <Field label="标题" required>
            <Input value={ann.title} onChange={(e) => setAnn({ ...ann, title: e.target.value })} />
          </Field>
          <Field label="正文" required>
            <Textarea rows={3} value={ann.body} onChange={(e) => setAnn({ ...ann, body: e.target.value })} />
          </Field>
          <Button size="sm" onClick={() => create("announcement", ann)}>发布公告</Button>
        </div>
        <ul className="mt-3 space-y-1 text-xs">
          {announcements.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{a.pinned ? "📌" : ""}{a.title}</span>
              <button className="text-red-500 hover:underline" onClick={() => remove("announcement", a.id)}>删除</button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="案例灵感库">
        <div className="space-y-2">
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
          <Button size="sm" onClick={() => create("inspiration", ins)}>发布案例</Button>
        </div>
        <ul className="mt-3 space-y-1 text-xs">
          {inspirations.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{i.title}</span>
              <button className="text-red-500 hover:underline" onClick={() => remove("inspiration", i.id)}>删除</button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Office Hour">
        <div className="space-y-2">
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
          <Button size="sm" onClick={() => create("officeHour", oh)}>发布</Button>
        </div>
        <ul className="mt-3 space-y-1 text-xs">
          {officeHours.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2">
              <span className="truncate">{o.title}</span>
              <button className="text-red-500 hover:underline" onClick={() => remove("officeHour", o.id)}>删除</button>
            </li>
          ))}
        </ul>
      </Card>

      {msg && <p className="text-xs text-slate-500 lg:col-span-3">{msg}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea, cn } from "@/components/ui";

export function TrackForm({ initial }: { initial: { id: string; name: string; description: string; suitable: string; unsuitable: string; example: string } }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/organizer/tracks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? "已保存" : json.error ?? "保存失败" });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <section className="rounded-md border border-ink-900/10 bg-ink-50/40 p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[14px] font-bold tracking-wide text-ink-900">{form.name}</h3>
        <code className="tnum text-[11px] text-ink-500">{form.id}</code>
      </header>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="赛道名称">
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <Field label="一句话说明">
          <Input value={form.description} onChange={set("description")} />
        </Field>
        <Field label="适合做什么">
          <Textarea rows={2} value={form.suitable} onChange={set("suitable")} />
        </Field>
        <Field label="不适合做什么">
          <Textarea rows={2} value={form.unsuitable} onChange={set("unsuitable")} />
        </Field>
        <div className="md:col-span-2">
          <Field label="微型示例">
            <Textarea rows={2} value={form.example} onChange={set("example")} />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 border-t border-ink-900/10 pt-3">
        <Button onClick={save} loading={busy}>保存</Button>
        {msg && (
          <span
            role="status"
            className={cn("inline-flex items-center gap-1.5 text-xs font-medium", msg.ok ? "text-emerald-700" : "text-red-600")}
          >
            {msg.ok && (
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="8" cy="8" r="6.4" />
                <path d="m5.4 8.2 1.8 1.8 3.4-4" />
              </svg>
            )}
            {msg.text}
          </span>
        )}
      </div>
    </section>
  );
}

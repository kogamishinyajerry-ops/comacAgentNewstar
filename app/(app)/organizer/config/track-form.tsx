"use client";

import { useState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";

export function TrackForm({ initial }: { initial: { id: string; name: string; description: string; suitable: string; unsuitable: string; example: string } }) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/organizer/tracks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "已保存" : json.error ?? "保存失败");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={`赛道ID:${form.id}`} >
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
      <div className="mt-2 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

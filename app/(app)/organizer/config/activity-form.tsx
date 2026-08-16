"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

export function ActivityForm(initial: { initial: Record<string, string> }) {
  const [form, setForm] = useState(initial.initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/organizer/activity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    setMsg(res.ok ? "已保存" : "保存失败");
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Card title="活动基础配置">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="活动名称" required>
          <Input value={form.name} onChange={set("name")} />
        </Field>
        <Field label="口号" required>
          <Input value={form.slogan} onChange={set("slogan")} />
        </Field>
        <Field label="开始日期">
          <Input value={form.startDate} onChange={set("startDate")} placeholder="2026-08-15" />
        </Field>
        <Field label="结束日期">
          <Input value={form.endDate} onChange={set("endDate")} placeholder="2026-10-15" />
        </Field>
        <Field label="提交截止">
          <Input value={form.submissionDeadline} onChange={set("submissionDeadline")} placeholder="2026-10-10 18:00" />
        </Field>
        <div className="md:col-span-2">
          <Field label="活动简介">
            <Textarea rows={2} value={form.intro} onChange={set("intro")} />
          </Field>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
        {msg && <span className="text-xs text-slate-500">{msg}</span>}
      </div>
    </Card>
  );
}

"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Textarea, cn } from "@/components/ui";

function SaveMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
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
  );
}

export function ActivityForm(initial: { initial: Record<string, string> }) {
  const [form, setForm] = useState(initial.initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/organizer/activity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? "已保存" : "保存失败" });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <Card title="活动基础配置">
      {/* 长表单分组节奏:身份 → 时间 → 叙述,逐段推进不分神 */}
      <fieldset className="min-w-0">
        <legend className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">身份</legend>
        <div className="mt-2.5 grid gap-3 md:grid-cols-2">
          <Field label="活动名称" required>
            <Input value={form.name} onChange={set("name")} />
          </Field>
          <Field label="口号" required>
            <Input value={form.slogan} onChange={set("slogan")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0 border-t border-ink-900/10 pt-4">
        <legend className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">时间安排</legend>
        <p className="mt-1 text-xs leading-5 text-ink-500">未确定的日期保持留空,前台会显示「待定」,不编造事实。</p>
        <div className="mt-2.5 grid gap-3 md:grid-cols-3">
          <Field label="开始日期">
            <Input value={form.startDate} onChange={set("startDate")} placeholder="2026-08-15" />
          </Field>
          <Field label="结束日期">
            <Input value={form.endDate} onChange={set("endDate")} placeholder="2026-10-15" />
          </Field>
          <Field label="提交截止">
            <Input value={form.submissionDeadline} onChange={set("submissionDeadline")} placeholder="2026-10-10 18:00" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="mt-5 min-w-0 border-t border-ink-900/10 pt-4">
        <legend className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-500">叙述</legend>
        <div className="mt-2.5">
          <Field label="活动简介">
            <Textarea rows={3} value={form.intro} onChange={set("intro")} />
          </Field>
        </div>
      </fieldset>

      <div className="mt-5 flex items-center gap-3 border-t border-ink-900/10 pt-4">
        <Button onClick={save} loading={busy}>保存</Button>
        <SaveMsg msg={msg} />
      </div>
    </Card>
  );
}

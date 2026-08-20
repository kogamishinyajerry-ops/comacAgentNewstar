"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Seal } from "@/components/seal";

/**
 * 注册页(设计系统 v2,2026-08-20 Act 5)
 * - 居中构图:印章 + 眉行 + 宋体大标题,纸面卡承载表单;
 * - 反馈:Button loading、错误 Alert(role=alert)、输入三态;
 * - 契约不变:POST /api/auth/register、placeholder「真实姓名或常用昵称」、
 *   按钮名「注册并开始」、minLength=8。
 */
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "注册失败");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="mx-auto mt-12 max-w-md anim-rise-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <Seal size={44} char="解" tilt />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">
          从一个真实问题开始
        </p>
        <h1 className="font-display mt-2 text-display-md text-ink-900">注册参与</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-500">
          一分钟完成注册,从一个小而真的问题开始。
        </p>
      </div>
      <div className="surface-card p-8 sm:p-9">
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="姓名" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="真实姓名或常用昵称"
              autoComplete="name"
              required
              className="h-11"
            />
          </Field>
          <Field label="邮箱" required>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoComplete="email"
              required
              className="h-11"
            />
          </Field>
          <Field label="密码" required hint="至少8位">
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              minLength={8}
              required
              className="h-11"
            />
          </Field>
          <Button type="submit" loading={busy} size="lg" className="w-full">
            注册并开始
          </Button>
        </form>
        <p className="mt-5 text-center text-xs leading-5 text-ink-400">
          注册即表示同意活动规则与数据承诺(第1步可再次确认)。
        </p>
      </div>
    </div>
  );
}

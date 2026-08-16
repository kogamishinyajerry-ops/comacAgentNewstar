"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Input } from "@/components/ui";

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
    <div className="mx-auto mt-12 max-w-md">
      <div className="surface-card p-8">
        <div className="mb-6">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">注册参与</h1>
          <p className="mt-1 text-[13px] text-slate-500">一分钟完成注册,从一个小而真的问题开始。</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              姓名 <span className="text-red-500">*</span>
            </span>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="真实姓名或常用昵称"
              required
              className="h-10"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              邮箱 <span className="text-red-500">*</span>
            </span>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="h-10" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">
              密码 <span className="text-red-500">*</span>
            </span>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={8}
              required
              className="h-10"
            />
            <span className="mt-1 block text-xs text-slate-400">至少8位</span>
          </label>
          <Button type="submit" disabled={busy} size="lg" className="w-full">
            {busy ? "注册中…" : "注册并开始"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">注册即表示同意活动规则与数据承诺(第1步可再次确认)。</p>
      </div>
    </div>
  );
}

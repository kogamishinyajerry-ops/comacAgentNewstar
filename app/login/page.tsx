"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Card, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "登录失败");
      return;
    }
    router.push(data.role === "JUDGE" ? "/judge" : data.role === "ORGANIZER" || data.role === "ADMIN" ? "/organizer" : "/projects");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md py-10">
      <Card title="登录">
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="邮箱" required>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
          </Field>
          <Field label="密码" required>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "登录中…" : "登录"}
          </Button>
          <p className="text-center text-xs text-slate-500">
            还没有账号?<Link href="/register" className="text-brand-600 hover:underline">注册</Link>
            <span className="mx-2">·</span>
            收到邀请码?<Link href="/join" className="text-brand-600 hover:underline">加入队伍</Link>
          </p>
        </form>
      </Card>
      <div className="mt-4 rounded-md border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <p className="mb-1 font-medium text-slate-600">演示账号(密码均为 demo1234)</p>
        <p>参与者 alice@demo.com(已提交作品)/ bob@demo.com(草稿中)</p>
        <p>组织者 organizer@demo.com · 评委 judge1@demo.com · 管理员 admin@demo.com</p>
      </div>
    </div>
  );
}

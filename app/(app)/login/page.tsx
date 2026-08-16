"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { Seal } from "@/components/seal";

function BrandPanel() {
  return (
    <aside className="relative hidden w-[420px] shrink-0 overflow-hidden bg-ink-900 p-10 text-paper lg:flex lg:flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 15%, rgba(185,74,38,0.28) 0, transparent 42%), radial-gradient(circle at 85% 80%, rgba(185,74,38,0.16) 0, transparent 38%)",
        }}
      />
      <div className="relative">
        <Seal size={40} char="解" tilt />
        <h1 className="font-display mt-8 text-[26px] font-bold leading-[1.4] tracking-tight">
          发现一个真问题,
          <br />
          做一个可验证的解法。
        </h1>
        <ul className="mt-8 space-y-3.5 text-[13px] text-ink-200">
          {[
            ["10 步向导", "从真问题到可验证解法,每步都有示例"],
            ["5 个测试案例", "必须包含失败情况——失败是被鼓励展示的证据"],
            ["三项轻交付", "小实验卡 + 可见结果 + 90秒Demo,不写长报告"],
            ["专职 Agent 陪跑", "先诊断、再追问、后建议,每次最多3条"],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-2.5">
              <span className="mt-[7px] h-[6px] w-[6px] shrink-0 rotate-45 bg-brand-500" aria-hidden />
              <span>
                <span className="font-semibold text-paper">{t}</span>
                <span className="ml-1.5 text-ink-300">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative mt-auto text-xs tracking-wide text-ink-400">内部活动平台 · 数据仅使用公开/模拟/已脱敏样例</p>
    </aside>
  );
}

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
    <div className="mx-auto mt-8 flex max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
      <BrandPanel />
      <div className="flex-1 p-8 sm:p-10">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">登录</h2>
        <p className="mt-1 text-[13px] text-slate-500">使用邮箱登录,或用下方演示账号体验。</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">邮箱</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="h-10" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">密码</span>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
          </label>
          <Button type="submit" disabled={busy} size="lg" className="w-full">
            {busy ? "登录中…" : "登录"}
          </Button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-500">
          还没有账号?<Link href="/register" className="font-medium text-brand-600 hover:underline">注册</Link>
          <span className="mx-2 text-slate-300">·</span>
          收到邀请码?<Link href="/join" className="font-medium text-brand-600 hover:underline">加入队伍</Link>
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">演示账号 · 密码均为 demo1234</p>
          <dl className="grid grid-cols-[64px_1fr] gap-x-3 gap-y-1.5 text-xs">
            {[
              ["参与者", "alice@demo.com 已提交作品样例 · bob@demo.com 双人队草稿中"],
              ["组织者", "organizer@demo.com"],
              ["评委", "judge1@demo.com"],
              ["管理员", "admin@demo.com"],
            ].map(([role, desc]) => (
              <div key={role} className="col-span-2 grid grid-cols-[64px_1fr] gap-x-3">
                <dt className="font-medium text-slate-600">{role}</dt>
                <dd className="tnum text-slate-500">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

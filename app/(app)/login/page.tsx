"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert, Button, Field, Input } from "@/components/ui";
import { Seal } from "@/components/seal";

/**
 * 登录页(设计系统 v2,2026-08-20 Act 5)
 * - 第一印象:纸面中央一张双栏卡,左栏墨底品牌叙事,右栏精致表单;
 * - 反馈:Button loading(spinner + aria-busy)、错误 Alert(role=alert)、
 *   输入 hover/focus 三态;卡片 anim-rise-in 进场(reduced-motion 下停用);
 * - 契约不变:POST /api/auth/login、字段名、label「邮箱/密码」、按钮名「登录」。
 */
function BrandPanel() {
  return (
    <aside className="relative hidden w-[400px] shrink-0 overflow-hidden bg-ink-900 p-10 text-paper lg:flex lg:flex-col">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 12%, rgba(185,74,38,0.32) 0, transparent 44%), radial-gradient(circle at 88% 82%, rgba(185,74,38,0.18) 0, transparent 40%), linear-gradient(180deg, rgba(247,244,236,0.04) 0, transparent 30%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-10 top-10 h-px bg-paper/10"
        aria-hidden
      />
      <div className="relative pt-6">
        <div className="flex items-center gap-3">
          <Seal size={40} char="解" tilt />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-paper/60">
            内部活动平台
          </span>
        </div>
        <h1 className="font-display mt-10 text-display-md text-paper">
          发现一个真问题,
          <br />
          做一个可验证的解法。
        </h1>
        <ul className="mt-10 space-y-4 text-[13px] leading-6">
          {[
            ["10 步向导", "从真问题到可验证解法,每步都有示例"],
            ["5 个测试案例", "必须包含失败情况——失败是被鼓励展示的证据"],
            ["三项轻交付", "小实验卡 + 可见结果 + 90秒Demo,不写长报告"],
            ["专职 Agent 陪跑", "先诊断、再追问、后建议,每次最多3条"],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-[9px] h-[6px] w-[6px] shrink-0 rotate-45 bg-brand-500" aria-hidden />
              <span>
                <span className="font-semibold text-paper">{t}</span>
                <span className="ml-2 text-paper/60">{d}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative mt-auto border-t border-paper/10 pt-4 text-xs tracking-wide text-paper/50">
        数据仅使用公开/模拟/已脱敏样例
      </p>
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
    <div className="mx-auto mt-10 max-w-4xl anim-rise-in">
      <div className="flex overflow-hidden rounded-xl border border-ink-900/10 bg-[#fffdf8] shadow-card-app">
        <BrandPanel />
        <div className="flex-1 p-8 sm:p-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">
            欢迎回来
          </p>
          <h2 className="font-display mt-2 text-display-md text-ink-900">登录</h2>
          <p className="mt-2 text-[13px] leading-6 text-ink-500">
            使用邮箱登录,或用下方演示账号体验。
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="邮箱" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-11"
              />
            </Field>
            <Field label="密码" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="h-11"
              />
            </Field>
            <Button type="submit" loading={busy} size="lg" className="w-full">
              登录
            </Button>
          </form>
          <p className="mt-5 text-center text-xs text-ink-400">
            还没有账号?
            <Link href="/register" className="ml-1 font-medium text-brand-600 underline-offset-2 hover:underline">
              注册
            </Link>
            <span className="mx-2 text-ink-200">·</span>
            收到邀请码?
            <Link href="/join" className="ml-1 font-medium text-brand-600 underline-offset-2 hover:underline">
              加入队伍
            </Link>
          </p>

          <div className="mt-8 rounded-lg border border-ink-900/10 bg-ink-50/70 p-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">
              演示账号 · 密码均为 demo1234
            </p>
            <dl className="space-y-1.5 text-xs leading-5">
              {[
                ["参与者", "alice@demo.com 已提交作品样例 · bob@demo.com 双人队草稿中"],
                ["组织者", "organizer@demo.com"],
                ["评委", "judge1@demo.com"],
                ["管理员", "admin@demo.com"],
              ].map(([role, desc]) => (
                <div key={role} className="grid grid-cols-[56px_1fr] gap-x-3">
                  <dt className="font-medium text-ink-700">{role}</dt>
                  <dd className="tnum text-ink-500">{desc}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

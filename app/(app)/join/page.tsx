"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { Seal } from "@/components/seal";

/**
 * 邀请码入队页(设计系统 v2,2026-08-20 Act 5)
 * - 与登录/注册同一套居中构图与表单语言;
 * - 反馈:Button loading、错误 Alert(role=alert);邀请码自动转大写并等宽呈现;
 * - 契约不变:POST /api/teams/join、字段 inviteCode/seatRole、选项文案、按钮名「加入队伍」。
 */
export default function JoinPage() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [seatRole, setSeatRole] = useState("DELTA");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/teams/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode, seatRole }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "加入失败");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md py-12 anim-rise-in">
      <div className="mb-8 flex flex-col items-center text-center">
        <Seal size={44} char="队" tilt />
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-600">
          双人协作
        </p>
        <h1 className="font-display mt-2 text-display-md text-ink-900">加入队伍</h1>
        <p className="mt-2 text-[13px] leading-6 text-ink-500">
          输入队长分享的邀请码,选择你的分工。
        </p>
      </div>
      <div className="surface-card p-8 sm:p-9">
        <form onSubmit={submit} className="space-y-5">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="邀请码" required hint={'由队长在「第2步:组队」中分享,8位字母数字'}>
            <Input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="例如 A1B2C3D4"
              maxLength={16}
              required
              className="tnum h-11 tracking-[0.12em]"
            />
          </Field>
          <Field label="我的分工" required hint="双人队建议:一人负责问题与需求(Echo),一人负责构建与测试(Delta)">
            <Select value={seatRole} onChange={(e) => setSeatRole(e.target.value)} className="h-11">
              <option value="ECHO">Echo:真实问题、业务场景、需求和判定标准</option>
              <option value="DELTA">Delta:工具选择、MVP构建和测试闭环</option>
            </Select>
          </Field>
          <Button type="submit" loading={busy} size="lg" className="w-full">
            加入队伍
          </Button>
          <p className="text-center text-xs leading-5 text-ink-400">
            每队最多2人,加入后不可再加入其他队伍。
          </p>
        </form>
      </div>
    </div>
  );
}

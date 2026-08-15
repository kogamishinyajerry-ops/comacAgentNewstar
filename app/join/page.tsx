"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

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
    <div className="mx-auto max-w-md py-10">
      <Card title="输入邀请码加入队伍">
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="邀请码" required hint={'由队长在「第2步:组队」中分享,8位字母数字'}>
            <Input value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} placeholder="例如 A1B2C3D4" maxLength={16} required />
          </Field>
          <Field label="我的分工" required hint="双人队建议:一人负责问题与需求(Echo),一人负责构建与测试(Delta)">
            <Select value={seatRole} onChange={(e) => setSeatRole(e.target.value)}>
              <option value="ECHO">Echo:真实问题、业务场景、需求和判定标准</option>
              <option value="DELTA">Delta:工具选择、MVP构建和测试闭环</option>
            </Select>
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "加入中…" : "加入队伍"}
          </Button>
          <p className="text-center text-xs text-slate-500">每队最多2人,加入后不可再加入其他队伍。</p>
        </form>
      </Card>
    </div>
  );
}

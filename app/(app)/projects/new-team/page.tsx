"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Input, Select } from "@/components/ui";

export default function NewTeamPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState("SOLO");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mode }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "创建失败");
      return;
    }
    router.push("/projects");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md py-10 sm:py-14">
      <header className="mb-6 text-center">
        <p className="kicker">组队 · Team</p>
        <h1 className="font-display text-display-lg mt-2 text-ink-900">创建队伍</h1>
        <p className="text-caption mt-2.5 text-ink-500">
          一个人也能出发；找到搭档，再把它变成双人互补。
        </p>
      </header>
      <Card className="animate-rise">
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="队伍名称" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如:艾的实验小队" required />
          </Field>
          <Field label="参赛模式" required hint="双人队加入第二名成员后自动切换为双人互补">
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="SOLO">单人参赛</option>
              <option value="DUO">双人互补(稍后邀请搭档)</option>
            </Select>
          </Field>
          <Button type="submit" loading={busy} className="w-full">
            创建队伍
          </Button>
          <p className="text-center text-xs leading-5 text-ink-400">
            每队最多2人;不允许通过顾问、外围成员等变相扩编。
          </p>
        </form>
      </Card>
    </div>
  );
}

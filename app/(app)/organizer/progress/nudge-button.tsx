"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function NudgeButton({ projectId, title, nextHint }: { projectId: string; title: string; nextHint: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function nudge() {
    const custom = prompt(
      `给「${title}」的队伍发一条温和提醒(留空使用默认话术):\n\n默认:最新进展已同步,最小下一步:${nextHint}`,
      ""
    );
    if (custom === null) return; // 取消
    setBusy(true);
    setError("");
    const res = await fetch("/api/organizer/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, message: custom.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "发送失败");
      return;
    }
    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-xs text-emerald-600">已提醒</span>;
  return (
    <span className="inline-flex flex-col items-end">
      <Button size="sm" variant="secondary" disabled={busy} onClick={nudge}>
        {busy ? "发送中…" : "温和提醒"}
      </Button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  );
}

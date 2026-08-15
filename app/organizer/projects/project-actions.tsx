"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function OrganizerProjectActions({ projectId, status }: { projectId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  async function act(action: string, reason?: string) {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/organizer/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "操作失败");
      return;
    }
    setReturning(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {status === "SUBMITTED" && (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("preliminary")}>进入预赛</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReturning(!returning)}>退回补充</Button>
        </>
      )}
      {status === "PRELIMINARY" && (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("final")}>进入决赛</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setReturning(!returning)}>退回补充</Button>
        </>
      )}
      {["SUBMITTED", "PRELIMINARY", "FINAL", "RETURNED"].includes(status) && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => { if (confirm("确认归档该作品?")) act("archive"); }}>
          归档
        </Button>
      )}
      {returning && (
        <div className="mt-1 flex w-full items-center gap-1">
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="退回原因(必填)"
            className="w-44 rounded border border-slate-300 px-2 py-1 text-xs"
          />
          <Button size="sm" disabled={!reason.trim()} onClick={() => act("return", reason)}>确认退回</Button>
        </div>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { ConfirmModal } from "../confirm-modal";

type Pending =
  | { kind: "return" }
  | { kind: "archive" }
  | null;

export function OrganizerProjectActions({ projectId, status, title }: { projectId: string; status: string; title: string }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const busy = busyAction !== null;

  async function act(action: string, returnReason?: string) {
    setBusyAction(action);
    setError("");
    const res = await fetch(`/api/organizer/projects/${projectId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: returnReason }),
    });
    const json = await res.json().catch(() => ({}));
    setBusyAction(null);
    if (!res.ok) {
      setError(json.error ?? "操作失败");
      return;
    }
    setPending(null);
    setReason("");
    router.refresh();
  }

  function close() {
    setPending(null);
    setReason("");
    setError("");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "SUBMITTED" && (
        <>
          <Button size="sm" variant="secondary" loading={busyAction === "preliminary"} disabled={busy} onClick={() => act("preliminary")}>进入预赛</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPending({ kind: "return" })}>退回补充</Button>
        </>
      )}
      {status === "PRELIMINARY" && (
        <>
          <Button size="sm" variant="secondary" loading={busyAction === "final"} disabled={busy} onClick={() => act("final")}>进入决赛</Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setPending({ kind: "return" })}>退回补充</Button>
        </>
      )}
      {["SUBMITTED", "PRELIMINARY", "FINAL", "RETURNED"].includes(status) && (
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPending({ kind: "archive" })}>
          归档
        </Button>
      )}
      {error && !pending && <span role="alert" className="text-xs text-red-600">{error}</span>}

      <ConfirmModal
        open={pending?.kind === "return"}
        title={`退回「${title}」补充`}
        desc="作品将退回给队伍修改,请写清退回原因,队伍会在通知中看到。"
        confirmLabel="确认退回"
        danger
        busy={busy}
        error={error}
        confirmDisabled={!reason.trim()}
        onClose={close}
        onConfirm={() => act("return", reason)}
      >
        <div className="mt-3">
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="退回原因(必填)"
            aria-label="退回原因"
          />
        </div>
      </ConfirmModal>

      <ConfirmModal
        open={pending?.kind === "archive"}
        title={`归档「${title}」?`}
        desc="归档后作品进入只读存档,不再参与后续流转。此操作可在审计日志中追溯。"
        confirmLabel="确认归档"
        danger
        busy={busy}
        error={error}
        onClose={close}
        onConfirm={() => act("archive")}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ConfirmModal } from "../confirm-modal";

export function ActivatePromptButton({ id, version }: { id: string; version: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/organizer/prompts/${id}/activate`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "切换失败");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setError(""); setOpen(true); }}>
        设为生效
      </Button>
      <ConfirmModal
        open={open}
        title={`切换生效版本到 ${version}?`}
        desc="切换后,新的 Agent 调用立即使用该版本的 System Prompt;历史调用记录仍保留原版本号,可追溯。"
        confirmLabel="设为生效"
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={activate}
      />
    </>
  );
}

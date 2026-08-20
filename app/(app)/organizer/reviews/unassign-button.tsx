"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { ConfirmModal } from "../confirm-modal";

export function UnassignButton({ id, projectTitle, judgeName }: { id: string; projectTitle: string; judgeName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/organizer/assignments?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "取消失败");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setError(""); setOpen(true); }}>
        取消分配
      </Button>
      <ConfirmModal
        open={open}
        title="取消该评审分配?"
        desc={`将取消评委 ${judgeName} 对「${projectTitle}」的评审分配,未锁定的草稿评分会一并移除。`}
        confirmLabel="确认移除分配"
        danger
        busy={busy}
        error={error}
        onClose={() => setOpen(false)}
        onConfirm={remove}
      />
    </>
  );
}

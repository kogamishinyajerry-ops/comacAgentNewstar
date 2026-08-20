"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button } from "@/components/ui";
import { Modal } from "@/components/fx";

export function RecuseButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmRecuse() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/judge/assignments/${assignmentId}/recuse`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "回避申请失败,请稍后重试");
      return;
    }
    router.push("/judge");
    router.refresh();
  }

  return (
    <>
      <Button variant="danger" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        申请回避
      </Button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="确认回避该作品">
        <p className="text-[13px] leading-6 text-ink-600">
          回避后,该作品将从你的评审列表移除,且<span className="font-semibold text-ink-900">不可恢复</span>。
          仅在确实存在利益关联时使用。
        </p>
        {error && (
          <div className="mt-3">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button variant="danger" size="sm" onClick={confirmRecuse} loading={busy}>
            确认回避
          </Button>
        </div>
      </Modal>
    </>
  );
}

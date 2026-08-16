"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecuseButton({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="mt-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
      disabled={busy}
      onClick={async () => {
        if (!confirm("确认回避该作品?回避后不可恢复。")) return;
        setBusy(true);
        const res = await fetch(`/api/judge/assignments/${assignmentId}/recuse`, { method: "POST" });
        setBusy(false);
        if (res.ok) {
          router.push("/judge");
          router.refresh();
        }
      }}
    >
      {busy ? "提交中…" : "申请回避"}
    </button>
  );
}

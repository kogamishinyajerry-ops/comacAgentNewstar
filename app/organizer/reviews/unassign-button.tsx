"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function UnassignButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        if (!confirm("确认取消该分配?")) return;
        setBusy(true);
        const res = await fetch(`/api/organizer/assignments?id=${id}`, { method: "DELETE" });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      取消分配
    </Button>
  );
}

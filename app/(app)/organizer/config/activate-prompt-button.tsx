"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function ActivatePromptButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/api/organizer/prompts/${id}/activate`, { method: "POST" });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
    >
      设为生效
    </Button>
  );
}

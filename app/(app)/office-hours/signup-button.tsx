"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function SignupButton({ officeHourId, joined, full }: { officeHourId: string; joined: boolean; full: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={joined ? "secondary" : "primary"}
      disabled={busy || (!joined && full)}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/office-hours/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ officeHourId, action: joined ? "cancel" : "join" }),
        });
        setBusy(false);
        router.refresh();
      }}
    >
      {joined ? "取消报名" : full ? "已满" : "报名"}
    </Button>
  );
}

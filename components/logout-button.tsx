"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui";

/**
 * 退出登录(v2:接入 Button 的 loading 契约)
 * 点击后立即给出 spinner + aria-busy 反馈;API 契约不变(POST /api/auth/logout)。
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      退出
    </Button>
  );
}

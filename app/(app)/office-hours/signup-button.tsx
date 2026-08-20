"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { showToast } from "@/components/fx";

export function SignupButton({ officeHourId, joined, full }: { officeHourId: string; joined: boolean; full: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      variant={joined ? "secondary" : "primary"}
      loading={busy}
      disabled={!joined && full}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/office-hours/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ officeHourId, action: joined ? "cancel" : "join" }),
          });
          if (res.ok) {
            showToast({
              tone: "success",
              title: joined ? "已取消报名" : "报名成功",
              desc: joined ? undefined : "会议链接将由组织者发送,请留意站内通知。",
            });
          } else {
            showToast({ tone: "error", title: joined ? "取消失败" : "报名失败", desc: "请稍后重试。" });
          }
        } catch {
          showToast({ tone: "error", title: "网络异常", desc: "操作未完成,请检查网络后重试。" });
        } finally {
          setBusy(false);
          router.refresh();
        }
      }}
    >
      {joined ? "取消报名" : full ? "已满" : "报名"}
    </Button>
  );
}

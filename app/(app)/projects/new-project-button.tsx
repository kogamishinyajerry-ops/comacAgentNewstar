"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button, Input } from "@/components/ui";

export function NewProjectButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "创建失败");
      return;
    }
    router.push(`/projects/${data.projectId}/chat`);
  }

  if (!open) {
    return (
      <Button disabled={disabled} title={disabled ? "请先创建或加入队伍" : undefined} onClick={() => setOpen(true)}>
        + 新建想法
      </Button>
    );
  }
  return (
    <div className="animate-fade-in flex flex-wrap items-center gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim().length >= 2) create();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="想法名称,如:变更对比说明小助手"
        className="w-64 max-w-full"
        aria-label="想法名称"
      />
      <Button size="sm" loading={busy} disabled={title.trim().length < 2} onClick={create}>
        <Plus size={13} strokeWidth={2.4} aria-hidden />
        创建
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
      {error && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

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
    router.push(`/projects/${data.projectId}`);
  }

  if (!open) {
    return (
      <Button disabled={disabled} title={disabled ? "请先创建或加入队伍" : undefined} onClick={() => setOpen(true)}>
        + 新建想法
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && title.trim().length >= 2 && create()}
        placeholder="想法名称,如:变更对比说明小助手"
        className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
      />
      <Button size="sm" disabled={busy || title.trim().length < 2} onClick={create}>创建</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}

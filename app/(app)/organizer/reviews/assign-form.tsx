"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Select, cn } from "@/components/ui";
import { UserPlus } from "lucide-react";

export function AssignForm({
  projects,
  judges,
}: {
  projects: { id: string; title: string; status: string }[];
  judges: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [judgeId, setJudgeId] = useState(judges[0]?.id ?? "");
  const [round, setRound] = useState("PRELIMINARY");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/organizer/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, judgeId, round }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg({ ok: res.ok, text: res.ok ? "已分配" : json.error ?? "分配失败" });
    if (res.ok) router.refresh();
  }

  if (!projects.length || !judges.length) {
    return <p className="text-sm text-ink-500">需要至少一个已提交作品和一名评委。</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <Field label="作品">
        <Select className="w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}({p.status})</option>
          ))}
        </Select>
      </Field>
      <Field label="评委">
        <Select className="w-36" value={judgeId} onChange={(e) => setJudgeId(e.target.value)}>
          {judges.map((j) => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="轮次">
        <Select className="w-28" value={round} onChange={(e) => setRound(e.target.value)}>
          <option value="PRELIMINARY">预赛</option>
          <option value="FINAL">决赛</option>
        </Select>
      </Field>
      <Button loading={busy} onClick={submit}>
        <UserPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
        分配
      </Button>
      {msg && (
        <span
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            msg.ok ? "text-emerald-700" : "text-red-600"
          )}
        >
          {msg.ok && (
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="8" cy="8" r="6.4" />
              <path d="m5.4 8.2 1.8 1.8 3.4-4" />
            </svg>
          )}
          {msg.text}
        </span>
      )}
    </div>
  );
}

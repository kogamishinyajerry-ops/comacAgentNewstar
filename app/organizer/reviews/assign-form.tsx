"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Select } from "@/components/ui";

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
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setMsg("");
    const res = await fetch("/api/organizer/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, judgeId, round }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? "已分配" : json.error ?? "分配失败");
    if (res.ok) router.refresh();
  }

  if (!projects.length || !judges.length) {
    return <p className="text-sm text-slate-400">需要至少一个已提交作品和一名评委。</p>;
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-slate-500">
        作品
        <Select className="mt-1 w-56" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.title}({p.status})</option>
          ))}
        </Select>
      </label>
      <label className="text-xs text-slate-500">
        评委
        <Select className="mt-1 w-36" value={judgeId} onChange={(e) => setJudgeId(e.target.value)}>
          {judges.map((j) => (
            <option key={j.id} value={j.id}>{j.name}</option>
          ))}
        </Select>
      </label>
      <label className="text-xs text-slate-500">
        轮次
        <Select className="mt-1 w-28" value={round} onChange={(e) => setRound(e.target.value)}>
          <option value="PRELIMINARY">预赛</option>
          <option value="FINAL">决赛</option>
        </Select>
      </label>
      <Button disabled={busy} onClick={submit}>{busy ? "分配中…" : "分配"}</Button>
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </div>
  );
}

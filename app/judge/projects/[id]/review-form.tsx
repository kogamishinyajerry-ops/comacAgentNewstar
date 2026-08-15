"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card } from "@/components/ui";

const DIMENSIONS = [
  { key: "problemDefinition", label: "真问题与需求定义", desc: "问题真实、具体、有真实用户与场景" },
  { key: "originality", label: "原创过程与独立完成", desc: "披露如实,核心工作由1—2名参赛者完成" },
  { key: "closedLoop", label: "跑通闭环与人机边界", desc: "输入→处理→检查→人工确认→输出,责任清晰" },
  { key: "evidence", label: "验证证据与复盘", desc: "测试覆盖含失败案例,证据可核验" },
] as const;

type Scores = { problemDefinition: number; originality: number; closedLoop: number; evidence: number };

export function ReviewForm({
  assignmentId,
  locked,
  initial,
}: {
  assignmentId: string;
  locked: boolean;
  initial: Scores & { bestValue: string; topImprovement: string };
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Scores>({
    problemDefinition: initial.problemDefinition,
    originality: initial.originality,
    closedLoop: initial.closedLoop,
    evidence: initial.evidence,
  });
  const [bestValue, setBestValue] = useState(initial.bestValue);
  const [topImprovement, setTopImprovement] = useState(initial.topImprovement);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const total = scores.problemDefinition + scores.originality + scores.closedLoop + scores.evidence;

  async function save(lock: boolean) {
    setBusy(true);
    setMsg("");
    const res = await fetch(`/api/judge/reviews/${assignmentId}`, {
      method: lock ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...scores, bestValue, topImprovement }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(json.error ?? (lock ? "提交失败" : "保存失败"));
      return;
    }
    setMsg(lock ? "评分已锁定" : "草稿已保存");
    if (lock) router.refresh();
  }

  return (
    <Card title="四维40分评分">
      {locked && (
        <div className="mb-3">
          <Alert tone="success" title="评分已锁定">
            锁定后不可修改;如需调整请联系组织者。
          </Alert>
        </div>
      )}
      <div className="space-y-3">
        {DIMENSIONS.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">{d.label}</span>
              <span className="font-bold text-brand-700">{scores[d.key]}/10</span>
            </div>
            <p className="text-[11px] text-slate-400">{d.desc}</p>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              disabled={locked}
              value={scores[d.key]}
              onChange={(e) => setScores({ ...scores, [d.key]: Number(e.target.value) })}
              className="mt-1 w-full accent-brand-600"
            />
          </div>
        ))}
        <p className="text-center text-sm">
          总分 <span className="text-lg font-bold text-brand-700">{total}</span>/40
        </p>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">最大价值</span>
          <textarea
            rows={2}
            disabled={locked}
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            value={bestValue}
            onChange={(e) => setBestValue(e.target.value)}
            placeholder="这个作品最有价值的一点是什么"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">首要改进</span>
          <textarea
            rows={2}
            disabled={locked}
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm disabled:bg-slate-50"
            value={topImprovement}
            onChange={(e) => setTopImprovement(e.target.value)}
            placeholder="如果只改一件事,应该改什么"
          />
        </label>
        {!locked && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => save(false)} disabled={busy}>保存草稿</Button>
            <Button onClick={() => save(true)} disabled={busy || !bestValue.trim() || !topImprovement.trim()}>
              {busy ? "提交中…" : "提交并锁定"}
            </Button>
          </div>
        )}
        {msg && <p className="text-xs text-slate-500">{msg}</p>}
      </div>
    </Card>
  );
}

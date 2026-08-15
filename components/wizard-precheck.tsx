"use client";

import { useRef, useState } from "react";
import { PRECHECK_NOTE } from "@/lib/constants";
import { Alert, Badge, Button, Card, Input, cn } from "./ui";
import type { AttachmentItem, FeedbackItem, HardRuleView, WizardData } from "./wizard-types";

interface PrecheckResponse {
  ok: boolean;
  hardRules: HardRuleView[];
  canSubmit: boolean;
  agent: { feedback: FeedbackItem["content"]; status: string; provider: string };
  deliverables: {
    experimentCard: { header: { title: string; track: string; team: string; members: string; slogan: string }; sections: { heading: string; rows: { label: string; value: string }[] }[] };
    visibleResultChecklist: { key: string; label: string; desc: string }[];
    demoScript: { time: string; title: string; lines: string[] }[];
  };
}

export function PrecheckStep({ data, setStatus }: { data: WizardData; setStatus: (s: string) => void }) {
  const [result, setResult] = useState<PrecheckResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(data.attachments);
  const [linkForm, setLinkForm] = useState({ title: "", url: "" });
  const [attMsg, setAttMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run() {
    setBusy(true);
    const res = await fetch(`/api/projects/${data.projectId}/precheck`, { method: "POST" });
    const json = (await res.json().catch(() => null)) as PrecheckResponse | null;
    setBusy(false);
    if (json) setResult(json);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    const res = await fetch(`/api/projects/${data.projectId}/submit`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(json.error ?? "提交失败");
      if (json.blocking) setResult((prev) => (prev ? { ...prev, hardRules: prev.hardRules.map((r) => (json.blocking.some((b: HardRuleView) => b.code === r.code) ? { ...r, passed: false } : r)) } : prev));
      return;
    }
    setStatus("SUBMITTED");
  }

  async function withdraw() {
    if (!confirm("确认撤回?撤回后回到草稿状态,可修改后重新提交。")) return;
    await fetch(`/api/projects/${data.projectId}/submit`, { method: "DELETE" });
    setStatus("DRAFT");
  }

  const scores = result?.agent.feedback.precheck_scores ?? null;
  const canSubmit = result?.canSubmit ?? false;
  const submitted = ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(data.status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={busy || data.readOnly}>
          {busy ? "预检中…" : "运行提交预检"}
        </Button>
        {submitted && !data.readOnly && (
          <Button variant="secondary" onClick={withdraw}>撤回修改</Button>
        )}
        <a
          href={`/projects/${data.projectId}/card`}
          target="_blank"
          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          打开小实验卡与Demo脚本 →
        </a>
      </div>

      {submitError && <Alert tone="error" title="无法提交">{submitError}</Alert>}

      <Card title="可见结果材料(链接 / 截图 / 提示词 / 流程图等)">
        {attachments.length > 0 ? (
          <ul className="space-y-1.5">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-2 py-1.5 text-sm">
                <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium text-brand-600 hover:underline">
                  {a.title}
                </a>
                <span className="flex shrink-0 items-center gap-2 text-xs text-slate-400">
                  <Badge tone={a.kind === "FILE" ? "blue" : "gray"}>{a.kind === "FILE" ? `文件 ${a.sizeKb ?? "?"}KB` : "链接"}</Badge>
                  {!data.readOnly && (
                    <button
                      className="text-red-500 hover:underline"
                      onClick={async () => {
                        if (!confirm(`删除「${a.title}」?`)) return;
                        const res = await fetch(`/api/projects/${data.projectId}/attachments?attId=${a.id}`, { method: "DELETE" });
                        if (res.ok) setAttachments((prev) => prev.filter((x) => x.id !== a.id));
                      }}
                    >
                      删除
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">还没有材料。可添加在线链接或上传截图/提示词/流程图等文件。</p>
        )}
        {!data.readOnly && (
          <div className="mt-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="w-40"
                placeholder="标题,如:提示词v2"
                value={linkForm.title}
                onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })}
              />
              <Input
                className="w-64"
                placeholder="https://…"
                value={linkForm.url}
                onChange={(e) => setLinkForm({ ...linkForm, url: e.target.value })}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!linkForm.title.trim() || !/^https?:\/\//.test(linkForm.url)}
                onClick={async () => {
                  setAttMsg("");
                  const res = await fetch(`/api/projects/${data.projectId}/attachments`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "LINK", title: linkForm.title, url: linkForm.url }),
                  });
                  const json = await res.json().catch(() => ({}));
                  if (!res.ok) return setAttMsg(json.error ?? "添加失败");
                  setAttachments((prev) => [...prev, json.attachment]);
                  setLinkForm({ title: "", url: "" });
                }}
              >
                添加链接
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  setAttMsg("");
                  const fd = new FormData();
                  fd.set("file", file);
                  fd.set("title", file.name);
                  const res = await fetch(`/api/projects/${data.projectId}/attachments`, { method: "POST", body: fd });
                  const json = await res.json().catch(() => ({}));
                  setUploading(false);
                  if (fileInput.current) fileInput.current.value = "";
                  if (!res.ok) return setAttMsg(json.error ?? "上传失败");
                  setAttachments((prev) => [...prev, json.attachment]);
                }}
              />
              <Button size="sm" variant="secondary" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? "上传中…" : "上传文件(≤10MB)"}
              </Button>
              {attMsg && <span className="text-xs text-red-600">{attMsg}</span>}
            </div>
          </div>
        )}
      </Card>

      {result && (
        <>
          <Card title="硬规则校验">
            <ul className="space-y-2">
              {result.hardRules.map((r) => (
                <li key={r.code} className={cn("rounded-md border p-2.5 text-sm", r.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50")}>
                  <p className="flex items-center gap-2 font-medium">
                    <span>{r.passed ? "✓" : "✗"}</span>
                    {r.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">{r.message}</p>
                  {!r.passed && <p className="mt-1 text-xs text-red-700">如何解除:{r.fix}</p>}
                </li>
              ))}
            </ul>
            {!data.readOnly && (
              <div className="mt-3">
                {canSubmit ? (
                  <Button onClick={submit} disabled={submitting}>
                    {submitting ? "提交中…" : "确认提交(生成不可变快照)"}
                  </Button>
                ) : (
                  <Alert tone="error" title="硬条件未满足,暂不能提交">
                    请按上方「如何解除」提示逐条处理后再运行预检。
                  </Alert>
                )}
              </div>
            )}
          </Card>

          {scores && (
            <Card title="四维预检(Agent)">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { key: "problem_definition", label: "真问题与需求定义" },
                  { key: "originality", label: "原创过程与独立完成" },
                  { key: "closed_loop", label: "跑通闭环与人机边界" },
                  { key: "evidence", label: "验证证据与复盘" },
                ].map((d) => (
                  <div key={d.key} className="rounded-md border border-slate-200 p-3 text-center">
                    <p className="text-2xl font-bold text-brand-700">{scores[d.key as keyof typeof scores]}</p>
                    <p className="text-xs text-slate-500">/10</p>
                    <p className="mt-1 text-xs font-medium text-slate-600">{d.label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-sm">
                总分 <span className="text-lg font-bold text-brand-700">{scores.total}</span>/40
              </p>
              <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">{PRECHECK_NOTE}</p>
            </Card>
          )}

          <Card title="可见结果清单(三件套之二)">
            <ul className="space-y-1.5 text-sm text-slate-600">
              {result.deliverables.visibleResultChecklist.map((c) => (
                <li key={c.key} className="flex gap-2">
                  <span className="text-slate-400">☐</span>
                  <span>
                    <span className="font-medium">{c.label}</span> — {c.desc}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">链接、截图、提示词、流程图、工作流、前后对比或可运行原型,准备其中适用的即可。</p>
          </Card>

          <Card title="90秒Demo脚本(三件套之三)">
            <ol className="space-y-2 text-sm">
              {result.deliverables.demoScript.map((seg) => (
                <li key={seg.time} className="rounded border border-slate-100 p-2">
                  <p className="text-xs font-semibold text-brand-700">{seg.time} {seg.title}</p>
                  <ul className="mt-1 space-y-0.5 text-slate-600">
                    {seg.lines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>

          <p className="text-xs text-slate-400">
            Agent来源:{result.agent.provider}({result.agent.status})
            {result.agent.feedback.raw_feedback && " · 已降级为可读反馈"}
          </p>
        </>
      )}

      {!result && (
        <Alert tone="info">
          预检会执行:硬规则校验(组队、披露、必填、测试覆盖、求证闭环、敏感信息)、四维40分Agent预检,并生成小实验卡与90秒Demo脚本。
        </Alert>
      )}
    </div>
  );
}

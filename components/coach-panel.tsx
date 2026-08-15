"use client";

import { useEffect, useRef, useState } from "react";
import { RISK_LABELS, PRECHECK_NOTE, type RiskType } from "@/lib/constants";
import { getStepConfig } from "@/lib/steps";
import { Alert, Badge, Button, cn } from "./ui";
import { burstFromElement, showToast } from "./fx";
import type { FeedbackItem } from "./wizard-types";

const severityStyle: Record<string, string> = {
  high: "border-red-300 bg-red-50 text-red-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-slate-300 bg-slate-50 text-slate-700",
};

const stateLabel: Record<string, string> = { adopted: "已采纳", ignored: "忽略", done: "已处理" };

/** 诊断等待仪式:Echo/Delta双视角轮播 */
const DIAGNOSIS_PHASES = [
  "📡 正在读取你的项目上下文…",
  "🎯 Echo 视角:审视真问题与判定标准…",
  "🔧 Delta 视角:检查闭环与测试证据…",
  "⚖️ 对照活动红线:数据、原创、人机边界…",
  "✍️ 综合诊断结论生成中…",
];

export function CoachPanel({
  projectId,
  step,
  readOnly,
  feedbacks,
  onFeedback,
  onUpdateStates,
}: {
  projectId: string;
  step: number;
  readOnly: boolean;
  feedbacks: FeedbackItem[];
  onFeedback: (f: FeedbackItem) => void;
  onUpdateStates: (id: string, states: Record<string, string>) => void;
}) {
  const cfg = getStepConfig(step);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<FeedbackItem | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [phase, setPhase] = useState(0);
  const askBtnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!busy) {
      setPhase(0);
      return;
    }
    const iv = setInterval(() => setPhase((p) => (p + 1) % DIAGNOSIS_PHASES.length), 2600);
    return () => clearInterval(iv);
  }, [busy]);

  async function ask() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/projects/${projectId}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step, purpose: "COACH" }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Agent 暂时不可用,请稍后再试");
      showToast({ tone: "error", icon: "😵", title: "Agent 暂时不可用", desc: json.error ?? "请稍后再试" });
      return;
    }
    const item: FeedbackItem = {
      id: json.feedbackId ?? "",
      step,
      purpose: "COACH",
      content: json.feedback,
      suggestionStates: {},
      createdAt: new Date().toISOString(),
    };
    setLatest(item);
    onFeedback(item);
    if ((json.feedback?.suggestions?.length ?? 0) > 0) {
      burstFromElement(askBtnRef.current, 35);
    }
  }

  async function setState(fbId: string, index: number, state: string) {
    if (!fbId) return;
    const res = await fetch(`/api/agent/feedback/${fbId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index, state }),
    });
    if (res.ok) {
      const json = await res.json();
      onUpdateStates(fbId, json.states);
    }
  }

  const stepFeedbacks = feedbacks.filter((f) => f.step === step && f.purpose === "COACH");
  const display = latest ?? stepFeedbacks[0] ?? null;
  const fb = display?.content;
  const fbId = display?.id ?? "";

  return (
    <div className="sticky top-20 space-y-3">
      <div className="rounded-lg border border-brand-200 bg-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-brand-100 bg-brand-50 px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">AI</span>
          <div>
            <p className="text-sm font-semibold text-brand-800">专职Agent辅导</p>
            <p className="text-[10px] text-brand-600">Echo问题洞察 + Delta快速构建 · 只给最小下一步</p>
          </div>
        </header>
        <div className="space-y-3 px-3 py-3">
          {cfg?.coachFocus && (
            <p className="rounded bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-medium">本步重点:</span>
              {cfg.coachFocus}
            </p>
          )}
          {!readOnly && (
            <div ref={askBtnRef}>
              <Button size="sm" className="w-full" onClick={ask} disabled={busy}>
                {busy ? "诊断中…" : "获取Agent诊断"}
              </Button>
            </div>
          )}
          {busy && (
            <div className="space-y-1.5">
              <div className="anim-shimmer h-1.5 rounded-full" />
              <p className="flex items-center gap-1 text-[11px] font-medium text-brand-700">
                <span className="anim-float">{["🛰️", "🎯", "🔧", "⚖️", "✍️"][phase]}</span>
                {DIAGNOSIS_PHASES[phase]}
                <span className="inline-flex w-4 justify-start">
                  <span className="animate-pulse">…</span>
                </span>
              </p>
              <p className="text-[10px] leading-3 text-slate-400">GLM-5.3 深度思考中,通常需要30—75秒,值得等待</p>
            </div>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}

          {fb && (
            <div className="space-y-2.5 border-t border-slate-100 pt-2.5">
              <div>
                <Badge tone={fb.stage_assessment === "ready" ? "green" : fb.stage_assessment === "blocked" ? "red" : "amber"}>
                  {fb.stage_assessment === "ready" ? "可以继续" : fb.stage_assessment === "blocked" ? "存在阻塞" : "需要完善"}
                </Badge>
                <p className="mt-1 text-xs text-slate-700">{fb.summary}</p>
              </div>

              {fb.risk_flags.length > 0 && (
                <div className="space-y-1">
                  {fb.risk_flags.map((r, i) => (
                    <p key={i} className={cn("rounded border px-2 py-1 text-[11px] font-medium", severityStyle[r.severity] ?? severityStyle.low)}>
                      ⚠ {RISK_LABELS[r.type as RiskType] ?? r.type}:{r.message}
                    </p>
                  ))}
                </div>
              )}

              {fb.critical_gaps.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">关键缺口</p>
                  <ul className="mt-0.5 list-disc pl-4 text-[11px] text-slate-600">
                    {fb.critical_gaps.slice(0, 4).map((g, i) => (
                      <li key={i}>{g.reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              {fb.questions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">需要你回答</p>
                  <ul className="mt-0.5 list-decimal pl-4 text-[11px] text-slate-600">
                    {fb.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {fb.suggestions.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500">建议(最多3条,决策在你)</p>
                  <ul className="mt-1 space-y-1.5">
                    {fb.suggestions.map((s, i) => {
                      const st = (display?.suggestionStates ?? {})[String(i)] ?? "none";
                      return (
                        <li key={i} className="rounded border border-slate-200 p-2 text-[11px]">
                          <p className="font-medium text-slate-700">{i + 1}. {s.title}</p>
                          <p className="mt-0.5 text-slate-600">动作:{s.action}</p>
                          <p className="mt-0.5 text-slate-400">理由:{s.why}</p>
                          {!readOnly && (
                            <div className="mt-1.5 flex gap-1">
                              {(["adopted", "ignored", "done"] as const).map((v) => (
                                <button
                                  key={v}
                                  onClick={() => setState(fbId, i, v)}
                                  className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] border",
                                    st === v ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white text-slate-500 hover:border-brand-400"
                                  )}
                                >
                                  {stateLabel[v]}
                                </button>
                              ))}
                            </div>
                          )}
                          {readOnly && st !== "none" && <Badge tone="indigo">{stateLabel[st]}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <p className="rounded bg-brand-50 px-2 py-1.5 text-[11px] text-brand-800">
                👉 最小下一步:{fb.next_action}
              </p>
              {fb.precheck_scores && (
                <p className="text-[10px] text-slate-400">{PRECHECK_NOTE}</p>
              )}
              {fb.raw_feedback && (
                <details className="text-[11px] text-slate-500">
                  <summary className="cursor-pointer">查看降级原文</summary>
                  <p className="mt-1 whitespace-pre-wrap break-all">{fb.raw_feedback}</p>
                </details>
              )}
            </div>
          )}
        </div>
      </div>

      {stepFeedbacks.length > 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <button className="flex w-full items-center justify-between text-xs font-medium text-slate-600" onClick={() => setShowAll(!showAll)}>
            历史诊断({stepFeedbacks.length}) <span>{showAll ? "收起" : "展开"}</span>
          </button>
          {showAll && (
            <ul className="mt-2 space-y-2">
              {stepFeedbacks.slice(0, 10).map((f) => (
                <li key={f.id} className="border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                  <p>{new Date(f.createdAt).toLocaleString("zh-CN")} · {f.content.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Alert tone="info">
        Agent不是代写员也不是评委:它不替你虚构需求、数据与原创过程;分数仅为提交预检参考。
      </Alert>
    </div>
  );
}

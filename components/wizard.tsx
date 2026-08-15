"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STEPS, TEAM_FIELDS, getStepConfig } from "@/lib/steps";
import { levelOf } from "@/lib/gamification";
import { StatusBadge, AutoSaveIndicator, Alert, Button, Card, Input, Textarea, cn, Field } from "./ui";
import { burstFromElement, showToast } from "./fx";
import { LevelBadge, XpBar, useAchievementTracker, wizardProgress } from "./achievements";
import type { WizardData } from "./wizard-types";
import { TeamStep } from "./wizard-team";
import { TrackStep } from "./wizard-track";
import { TestsStep } from "./wizard-tests";
import { PrecheckStep } from "./wizard-precheck";
import { StatusStep } from "./wizard-status";
import { CoachPanel } from "./coach-panel";

/** 第1步三项承诺的短标题(完整条款折叠在卡片内) */
const CHECKBOX_SHORT: Record<string, string> = {
  agreeRules: "我已阅读并接受活动规则",
  agreeDataSafety: "数据安全与脱敏承诺",
  agreeOriginality: "原创与公平承诺",
};

export interface SaveState {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: string;
}

export function Wizard({ data }: { data: WizardData }) {
  const [step, setStep] = useState(Math.min(10, Math.max(1, data.currentStep)));
  const [stages, setStages] = useState(data.stages);
  const [track, setTrack] = useState(data.track);
  const [feedbacks, setFeedbacks] = useState(data.feedbacks);
  const [testCasesLive, setTestCasesLive] = useState(data.testCases);
  const [save, setSave] = useState<SaveState>({ state: "idle", savedAt: "" });
  const [gateError, setGateError] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef<Record<string, Record<string, unknown>>>({});
  const nextBtnRef = useRef<HTMLSpanElement | null>(null);
  const lastLevelRef = useRef<number>(0);

  // 实时游戏化:段位/成就跟随输入即时点亮
  const liveData = useMemo<WizardData>(() => ({ ...data, stages, track, feedbacks, testCases: testCasesLive }), [data, stages, track, feedbacks, testCasesLive]);
  const progress = wizardProgress(liveData);
  useAchievementTracker(data.projectId, liveData);
  const submittedNow = ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(data.status);
  const level = levelOf(progress.overallPct, submittedNow);

  useEffect(() => {
    if (lastLevelRef.current === 0) {
      lastLevelRef.current = level.lv;
      return;
    }
    if (level.lv > lastLevelRef.current) {
      lastLevelRef.current = level.lv;
      showToast({
        tone: "achievement",
        icon: level.icon,
        title: `段位提升 · Lv.${level.lv} ${level.name}`,
        desc: level.title,
        durationMs: 6000,
      });
    } else {
      lastLevelRef.current = Math.max(lastLevelRef.current, level.lv);
    }
  }, [level]);

  useEffect(() => {
    window.history.replaceState(null, "", `/projects/${data.projectId}?step=${step}`);
  }, [step, data.projectId]);

  const persistStage = useCallback(
    async (stepNum: number, payload: Record<string, unknown>, strict: boolean) => {
      setSave({ state: "saving", savedAt: "" });
      try {
        const res = await fetch(`/api/projects/${data.projectId}/stage/${stepNum}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload, strict }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.status === 422) return { ok: false, errors: json.errors ?? [] };
        if (!res.ok) {
          setSave({ state: "error", savedAt: "" });
          return { ok: false, errors: [{ field: "", reason: json.error ?? "保存失败" }] };
        }
        setSave({ state: "saved", savedAt: new Date().toLocaleTimeString("zh-CN") });
        return { ok: true, errors: json.errors ?? [] };
      } catch {
        setSave({ state: "error", savedAt: "" });
        return { ok: false, errors: [{ field: "", reason: "网络错误" }] };
      }
    },
    [data.projectId]
  );

  const updateField = useCallback(
    (stepNum: number, key: string, value: unknown) => {
      setStages((prev) => {
        const next = { ...prev, [stepNum]: { ...(prev[stepNum] ?? {}), [key]: value } };
        dirtyRef.current[stepNum] = next[stepNum];
        return next;
      });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const payload = dirtyRef.current[stepNum];
        if (payload) persistStage(stepNum, payload, false);
      }, 800);
    },
    [persistStage]
  );

  const saveTests = useCallback(
    async (cases: WizardData["testCases"], strict: boolean) => {
      setSave({ state: "saving", savedAt: "" });
      const res = await fetch(`/api/projects/${data.projectId}/tests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cases, strict }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 422) return { ok: false, errors: json.errors ?? [] };
      if (!res.ok) {
        setSave({ state: "error", savedAt: "" });
        return { ok: false, errors: [{ field: "", reason: json.error ?? "保存失败" }] };
      }
      setSave({ state: "saved", savedAt: new Date().toLocaleTimeString("zh-CN") });
      return { ok: true, errors: json.errors ?? [] };
    },
    [data.projectId]
  );

  /** 进入下一步前的门禁 */
  async function goto(n: number) {
    setGateError([]);
    if (n > step && !data.readOnly) {
      const gate = await gateStep();
      if (!gate.ok) {
        setGateError(gate.errors.map((e) => e.reason));
        showToast({ tone: "error", icon: "🚧", title: "还差一点", desc: gate.errors[0]?.reason ?? "请补齐必填项", durationMs: 3200 });
        return;
      }
      // 过步仪式:小彩带 + 完成提示
      burstFromElement(nextBtnRef.current, 40);
      const done = progress.steps.find((s) => s.step === step)?.status === "done";
      if (done && step <= 8) {
        showToast({ tone: "success", icon: "✅", title: `第${step}步完成 · ${getStepConfig(step)?.title}`, desc: "自动保存已生效,继续保持!", durationMs: 3000 });
      }
    }
    setStep(Math.min(10, Math.max(1, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function gateStep(): Promise<{ ok: boolean; errors: { field: string; reason: string }[] }> {
    if (step === 1) {
      const d = stages[1] ?? {};
      const missing = ["agreeRules", "agreeDataSafety", "agreeOriginality"].filter((k) => d[k] !== true);
      return missing.length
        ? { ok: false, errors: [{ field: "", reason: "请先完成三项合规勾选,才能进入下一步" }] }
        : { ok: true, errors: [] };
    }
    if (step === 2) {
      // 团队披露以服务端最新数据为准(TeamStep 内部自行保存)
      try {
        const res = await fetch("/api/teams");
        const json = (await res.json()) as { team?: Record<string, unknown> | null };
        const t = json.team ?? {};
        const missing = TEAM_FIELDS.filter((f) => !String(t[f.key] ?? "").trim());
        return missing.length
          ? { ok: false, errors: missing.map((f) => ({ field: f.key, reason: `原创披露必填:${f.label}` })) }
          : { ok: true, errors: [] };
      } catch {
        return { ok: false, errors: [{ field: "", reason: "网络错误,无法校验队伍信息" }] };
      }
    }
    if (step === 3) {
      return track ? { ok: true, errors: [] } : { ok: false, errors: [{ field: "track", reason: "请先选择一个赛道" }] };
    }
    if ([4, 5, 6].includes(step)) {
      return persistStage(step, stages[step] ?? {}, true);
    }
    if (step === 8) {
      return saveTests(data.testCases, true);
    }
    return { ok: true, errors: [] };
  }

  const cfg = getStepConfig(step)!;
  const fieldStep = [1, 4, 5, 6].includes(step);

  return (
    <div className="py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <StatusBadge status={data.status} />
          {data.status === "RETURNED" && data.returnReason && (
            <span className="text-xs text-amber-700">退回原因:{data.returnReason}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!data.readOnly && <AutoSaveIndicator state={save.state} savedAt={save.savedAt} />}
          <div className="hidden w-44 md:block">
            <XpBar pct={progress.overallPct} submitted={submittedNow} />
          </div>
          <LevelBadge pct={progress.overallPct} submitted={submittedNow} compact />
        </div>
      </div>

      {data.status === "RETURNED" && (
        <div className="mb-4">
          <Alert tone="warn" title="作品被退回补充">
            {data.returnReason || "组织者要求补充材料。请在修改后重新提交。"}
          </Alert>
        </div>
      )}

      {/* 步骤条 */}
      <nav className="no-print mb-5 overflow-x-auto" aria-label="步骤导航">
        <ol className="flex min-w-max items-center gap-1 text-xs">
          {STEPS.map((s, i) => (
            <li key={s.step} className="flex items-center">
              <button
                onClick={() => goto(s.step)}
                className={cn(
                  "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 font-medium transition-all",
                  s.step === step
                    ? "border-brand-600 bg-brand-600 text-white shadow-[0_2px_6px_rgba(79,70,229,0.3)]"
                    : s.step < step
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300"
                      : "border-slate-200 bg-white text-slate-500 hover:border-brand-400 hover:text-brand-600"
                )}
                title={s.title}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold",
                    s.step === step ? "bg-white/20" : s.step < step ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {s.step < step ? "✓" : s.step}
                </span>
                {s.title}
              </button>
              {i < STEPS.length - 1 && (
                <span className={cn("mx-0.5 h-px w-3", s.step < step ? "bg-emerald-300" : "bg-slate-200")} aria-hidden />
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className={cn("grid gap-5", step <= 8 ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "")}>
        <div className="min-w-0 space-y-4">
          <Card
            title={
              <span>
                第{step}步:{cfg.title}
                <span className="ml-2 font-normal text-xs text-slate-400">预计{cfg.minutes}分钟</span>
              </span>
            }
          >
            <p className="mb-4 line-clamp-2 text-[13px] leading-5 text-slate-500" title={cfg.subtitle}>
              {cfg.subtitle}
            </p>

            {gateError.length > 0 && (
              <div className="mb-4">
                <Alert tone="error" title="还不能进入下一步">
                  <ul className="list-disc pl-4">
                    {gateError.slice(0, 6).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </Alert>
              </div>
            )}

            {fieldStep && (
              <div className="space-y-3.5">
                {cfg.fields.map((f) => {
                  const value = (stages[step] ?? {})[f.key];
                  if (f.type === "checkbox") {
                    return (
                      <label
                        key={f.key}
                        className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3.5 py-3 text-[13px] transition-colors hover:border-brand-300 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50/60"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 accent-brand-600"
                          disabled={data.readOnly}
                          checked={value === true}
                          onChange={(e) => updateField(step, f.key, e.target.checked)}
                        />
                        <span className="min-w-0">
                          <span className="font-medium text-slate-800">
                            {CHECKBOX_SHORT[f.key] ?? f.label}
                            <span className="text-red-500">*</span>
                          </span>
                          <details className="group mt-0.5">
                            <summary className="cursor-pointer list-none text-xs text-slate-400 transition-colors hover:text-brand-600">
                              查看完整条款
                            </summary>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{f.label}</p>
                          </details>
                        </span>
                      </label>
                    );
                  }
                  return (
                    <Field key={f.key} label={f.label} required={f.required} hint={f.hint}>
                      {f.type === "textarea" ? (
                        <Textarea
                          rows={f.rows ?? 3}
                          disabled={data.readOnly}
                          placeholder={f.placeholder}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => updateField(step, f.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          disabled={data.readOnly}
                          placeholder={f.placeholder}
                          value={typeof value === "string" ? value : ""}
                          onChange={(e) => updateField(step, f.key, e.target.value)}
                        />
                      )}
                    </Field>
                  );
                })}
              </div>
            )}

            {step === 2 && (
              <TeamStep data={data} onSaved={() => setSave({ state: "saved", savedAt: new Date().toLocaleTimeString("zh-CN") })} />
            )}
            {step === 3 && <TrackStep track={track} readOnly={data.readOnly} projectId={data.projectId} onSelect={setTrack} />}
            {step === 7 && (
              <div className="space-y-3">
                <Alert tone="info">
                  点击右侧「获取Agent诊断」,系统会汇总前六步内容,给出当前判断、关键缺口、追问、最多3条建议与风险标记。所有建议仅供你参考,决策在你。
                </Alert>
                <p className="text-xs text-slate-500">诊断历史见右侧面板;已采纳/忽略/已处理的建议会保留记录。</p>
              </div>
            )}
            {step === 8 && (
              <TestsStep
                data={data}
                initialCases={testCasesLive}
                readOnly={data.readOnly}
                saveTests={saveTests}
                setSave={setSave}
                onChange={setTestCasesLive}
              />
            )}
            {step === 9 && <PrecheckStep data={data} setStatus={(s) => window.location.reload()} />}
            {step === 10 && <StatusStep data={data} />}
          </Card>

          <div className="no-print sticky bottom-4 -mx-1 flex items-center justify-between rounded-lg border border-slate-200/80 bg-white/95 px-3 py-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)] backdrop-blur">
            <Button variant="secondary" disabled={step <= 1} onClick={() => goto(step - 1)}>
              ← 上一步
            </Button>
            <span className="hidden text-xs text-slate-400 sm:inline">
              第 {step}/10 步 · {cfg.title} · 总进度 {progress.overallPct}%
            </span>
            <span ref={nextBtnRef}>
              <Button disabled={step >= 10} onClick={() => goto(step + 1)}>
                下一步 →
              </Button>
            </span>
          </div>
        </div>

        {step <= 8 && (
          <aside className="no-print">
            <CoachPanel
              projectId={data.projectId}
              step={step}
              readOnly={data.readOnly}
              feedbacks={feedbacks}
              onFeedback={(f) => setFeedbacks((prev) => [f, ...prev])}
              onUpdateStates={(id, states) =>
                setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, suggestionStates: states } : f)))
              }
            />
          </aside>
        )}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STEPS, TEAM_FIELDS, getStepConfig } from "@/lib/steps";
import { StatusBadge, AutoSaveIndicator, Alert, Button, Card, Input, Textarea, cn, Field } from "./ui";
import type { WizardData } from "./wizard-types";
import { TeamStep } from "./wizard-team";
import { TrackStep } from "./wizard-track";
import { TestsStep } from "./wizard-tests";
import { PrecheckStep } from "./wizard-precheck";
import { StatusStep } from "./wizard-status";
import { CoachPanel } from "./coach-panel";

export interface SaveState {
  state: "idle" | "saving" | "saved" | "error";
  savedAt: string;
}

export function Wizard({ data }: { data: WizardData }) {
  const [step, setStep] = useState(Math.min(10, Math.max(1, data.currentStep)));
  const [stages, setStages] = useState(data.stages);
  const [track, setTrack] = useState(data.track);
  const [feedbacks, setFeedbacks] = useState(data.feedbacks);
  const [save, setSave] = useState<SaveState>({ state: "idle", savedAt: "" });
  const [gateError, setGateError] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef<Record<string, Record<string, unknown>>>({});

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
        return;
      }
    }
    setStep(Math.min(10, Math.max(1, n)));
    window.scrollTo({ top: 0 });
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <StatusBadge status={data.status} />
          {data.status === "RETURNED" && data.returnReason && (
            <span className="text-xs text-amber-700">退回原因:{data.returnReason}</span>
          )}
        </div>
        {!data.readOnly && <AutoSaveIndicator state={save.state} savedAt={save.savedAt} />}
      </div>

      {data.status === "RETURNED" && (
        <div className="mb-4">
          <Alert tone="warn" title="作品被退回补充">
            {data.returnReason || "组织者要求补充材料。请在修改后重新提交。"}
          </Alert>
        </div>
      )}

      {/* 步骤条 */}
      <ol className="no-print mb-5 flex flex-wrap gap-1.5 text-xs">
        {STEPS.map((s) => (
          <li key={s.step}>
            <button
              onClick={() => goto(s.step)}
              className={cn(
                "rounded-full border px-2.5 py-1 transition",
                s.step === step
                  ? "border-brand-600 bg-brand-600 text-white"
                  : s.step < step
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500 hover:border-brand-400"
              )}
              title={s.title}
            >
              {s.step < step ? "✓ " : ""}{s.step}.{s.title}
            </button>
          </li>
        ))}
      </ol>

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
            <p className="mb-4 text-sm text-slate-500">{cfg.subtitle}</p>

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
              <div className="space-y-4">
                {cfg.fields.map((f) => {
                  const value = (stages[step] ?? {})[f.key];
                  if (f.type === "checkbox") {
                    return (
                      <label key={f.key} className="flex items-start gap-2 rounded-md border border-slate-200 p-3 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4"
                          disabled={data.readOnly}
                          checked={value === true}
                          onChange={(e) => updateField(step, f.key, e.target.checked)}
                        />
                        <span>
                          {f.label}
                          <span className="text-red-500">*</span>
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
                      {f.placeholder && f.type !== "textarea" && (
                        <span className="mt-1 block text-xs text-slate-400">示例:{f.placeholder}</span>
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
              <TestsStep data={data} readOnly={data.readOnly} saveTests={saveTests} setSave={setSave} />
            )}
            {step === 9 && <PrecheckStep data={data} setStatus={(s) => window.location.reload()} />}
            {step === 10 && <StatusStep data={data} />}
          </Card>

          <div className="no-print flex justify-between">
            <Button variant="secondary" disabled={step <= 1} onClick={() => goto(step - 1)}>
              ← 上一步
            </Button>
            <Button disabled={step >= 10} onClick={() => goto(step + 1)}>
              下一步 →
            </Button>
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

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STEPS, TEAM_FIELDS, getStepConfig } from "@/lib/steps";
import { levelOf } from "@/lib/gamification";
import { StatusBadge, AutoSaveIndicator, Alert, Button, Card, Input, ProgressBar, Textarea, cn, Field } from "./ui";
import { MissionBar } from "./charts";
import { burstFromElement, showToast, ArtRevealModal, XpFloat, type ArtRequest } from "./fx";
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

/** 里程碑步骤:首次完成时解锁AI插画盲盒 */
const ART_MILESTONES: Record<number, string> = {
  4: "真问题已被你捕获",
  5: "判定标准,就此立宪",
  6: "人机边界,画下第一笔",
  8: "五连测试,证据成军",
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
  const [artScene, setArtScene] = useState<string | null>(null);
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

  // XP浮动:总进度上升时冒出 +N%
  const [xpGain, setXpGain] = useState<number | null>(null);
  const prevPctRef = useRef(progress.overallPct);
  useEffect(() => {
    if (progress.overallPct > prevPctRef.current) {
      setXpGain(progress.overallPct - prevPctRef.current);
    }
    prevPctRef.current = progress.overallPct;
  }, [progress.overallPct]);

  // 完成步骤时步骤条胶囊弹跳
  const [popStep, setPopStep] = useState(0);
  // 闲置提醒:30秒无输入,下一步按钮呼吸发光
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    setIdle(false);
    const t = setTimeout(() => setIdle(true), 30000);
    return () => clearTimeout(t);
  }, [step, stages]);

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
      // 过步仪式:小彩带 + 完成提示 + 步骤胶囊弹跳
      burstFromElement(nextBtnRef.current, 40);
      const done = progress.steps.find((s) => s.step === step)?.status === "done";
      if (done) {
        setPopStep(step);
        setTimeout(() => setPopStep(0), 800);
      }
      if (done && step <= 8) {
        showToast({ tone: "success", icon: "✅", title: `第${step}步完成 · ${getStepConfig(step)?.title}`, desc: "自动保存已生效,继续保持!", durationMs: 3000 });
      }
      // 里程碑盲盒:关键步骤首次完成,解锁一张专属AI插画
      if (done && ART_MILESTONES[step]) {
        const flag = `ynav-art-fired:${data.projectId}:step-${step}`;
        try {
          if (!localStorage.getItem(flag)) {
            localStorage.setItem(flag, "1");
            setArtScene(`step-${step}`);
          }
        } catch {
          /* 隐私模式静默跳过 */
        }
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
  const cfgFieldsFilled = fieldStep
    ? (cfg.fields ?? []).filter((f) => {
        const v = (stages[step] ?? {})[f.key];
        return f.type === "checkbox" ? v === true : typeof v === "string" && v.trim().length > 0;
      }).length
    : 0;

  return (
    <div className="py-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-xl font-bold tracking-tight">{data.title}</h1>
          <StatusBadge status={data.status} />
          {!data.readOnly && (
            <a
              href={`/projects/${data.projectId}/chat`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-ink-900/15 px-2.5 text-[11px] font-medium text-ink-600 transition-colors hover:border-ink-900/40 hover:text-ink-900"
              title="和Agent对话,说出来我来整理"
            >
              💬 对话模式
            </a>
          )}
          {data.status === "RETURNED" && data.returnReason && (
            <span className="text-xs text-amber-700">退回原因:{data.returnReason}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {!data.readOnly && <AutoSaveIndicator state={save.state} savedAt={save.savedAt} />}
          {fieldStep && cfg.fields.length > 0 && (
            <div className="hidden w-24 md:block">
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>本步</span>
                <span className="tnum font-medium text-slate-600">{cfgFieldsFilled}/{cfg.fields.length}</span>
              </div>
              <ProgressBar
                pct={(cfgFieldsFilled / cfg.fields.length) * 100}
                height="h-1"
                tone={cfgFieldsFilled === cfg.fields.length ? "green" : "brand"}
              />
            </div>
          )}
          <div className="relative hidden w-44 md:block">
            <XpBar pct={progress.overallPct} submitted={submittedNow} />
            {xpGain != null && <XpFloat gain={xpGain} onDone={() => setXpGain(null)} />}
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

      {/* 任务里程碑条:真问题 → 闭环 → 证据 → 交付 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <MissionBar
          phases={[
            { label: "真问题", done: progress.steps[3]?.status === "done", hint: "第4步完整" },
            { label: "求证闭环", done: progress.closedLoopOk, hint: "判断依据/自动检查/人工确认/停止条件/责任人" },
            { label: "测试证据", done: progress.tests.passOk && progress.tests.coverageOk, hint: "≥5例且三类覆盖" },
            { label: "交付", done: ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(data.status) || data.snapshots.length > 0, hint: "提交快照" },
          ]}
        />
      </div>

      {/* 步骤条 */}
      <nav className="no-print mb-5 overflow-x-auto" aria-label="步骤导航">
        <ol className="flex min-w-max items-center gap-1 text-xs">
          {STEPS.map((s, i) => (
            <li key={s.step} className="flex items-center">
              <button
                onClick={() => goto(s.step)}
                className={cn(
                  "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 font-medium transition-all",
                  s.step === popStep && "anim-pop-in",
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
            key={step}
            className="anim-rise-in"
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
                  const filled = typeof value === "string" && value.trim().length > 0;
                  return (
                    <div key={f.key} className="relative">
                      <Field label={f.label} required={f.required} hint={f.hint}>
                        {f.type === "textarea" ? (
                          <Textarea
                            rows={f.rows ?? 3}
                            disabled={data.readOnly}
                            placeholder={f.placeholder}
                            className={cn(filled && "border-emerald-300/70 bg-emerald-50/30")}
                            value={typeof value === "string" ? value : ""}
                            onChange={(e) => updateField(step, f.key, e.target.value)}
                          />
                        ) : (
                          <Input
                            disabled={data.readOnly}
                            placeholder={f.placeholder}
                            className={cn(filled && "border-emerald-300/70 bg-emerald-50/30")}
                            value={typeof value === "string" ? value : ""}
                            onChange={(e) => updateField(step, f.key, e.target.value)}
                          />
                        )}
                      </Field>
                      <div className="absolute right-0 top-0 flex items-center gap-2">
                        {!data.readOnly && (
                          <a
                            href={`/projects/${data.projectId}/chat?focus=${step}.${f.key}`}
                            className="text-[10px] leading-5 text-ink-300 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-600"
                            title="到对话中重说:讲一句新说法,Agent帮你覆盖这一项"
                          >
                            💬 重说
                          </a>
                        )}
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-300",
                            filled ? "anim-pop-in bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-300"
                          )}
                          aria-hidden
                        >
                          ✓
                        </span>
                      </div>
                    </div>
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
                  Agent 汇总前六步,给出判断、缺口、<span className="font-semibold">拷问</span>与建议——它不代写,决策在你。
                </Alert>
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
            <span ref={nextBtnRef} className={cn(idle && "anim-glow-pulse rounded-md")}>
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
              onUpdateAnswers={(id, answers) =>
                setFeedbacks((prev) => prev.map((f) => (f.id === id ? { ...f, answers } : f)))
              }
            />
          </aside>
        )}
      </div>

      <ArtRevealModal
        open={!!artScene}
        onClose={() => setArtScene(null)}
        request={
          artScene
            ? {
                projectId: data.projectId,
                scene: artScene,
                title: data.title,
                track: track,
              }
            : null
        }
        caption={artScene ? ART_MILESTONES[Number(artScene.replace("step-", ""))] : undefined}
      />
    </div>
  );
}

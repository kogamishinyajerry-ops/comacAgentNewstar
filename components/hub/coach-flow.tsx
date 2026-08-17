"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { CoachOrb, COACH_STATE_LABELS } from "./coach-orb";
import { CoachScene } from "./coach-scene";
import { CoachWorkspaceScene } from "./coach-workspace-scene";
import { SeedCard } from "./seed-card";
import { coachPrivacyNotice, seedCopy, type CoachAct, type CoachEntry } from "@/fixtures/coach-demo";
import {
  ACT_COUNT,
  advance,
  actsFor,
  clearError,
  composeSeed,
  createCoachState,
  currentAct,
  isSubmittableAnswer,
  submitAnswer,
  visualStateFor,
  type CoachState,
} from "@/lib/hub/coach-machine";

type Action =
  | { type: "submit"; answer: string }
  | { type: "advance" }
  | { type: "clearError" }
  | { type: "reset" };

type CoachApiMode = "live" | "fixture";

interface CoachApiResponse {
  mode: CoachApiMode;
  act: CoachAct;
}

function reducer(state: CoachState, action: Action): CoachState {
  switch (action.type) {
    case "submit":
      return submitAnswer(state, action.answer);
    case "advance":
      return advance(state);
    case "clearError":
      return clearError(state);
    case "reset":
      return createCoachState(state.entry);
  }
}

const ENTRY_LABELS: Record<CoachEntry, string> = {
  problem: "入口:从一个真实问题开始",
  idea: "入口:我已经有一个想法",
};

const CLIENT_FALLBACK_NOTICE = "AI 服务暂不可用，本幕已按确定性追问继续。";
const CLIENT_REQUEST_TIMEOUT_MS = 100_000;
const WORKSPACE_STAGES = ["工作瞬间", "影响证据", "Agent 必要性"] as const;

/** transition 期满时长:默认与场景切换动效一致;减弱动态时缩短 */
function transitionMs(): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 160;
  }
  return 560;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isCoachAct(value: unknown): value is CoachAct {
  if (typeof value !== "object" || value === null) return false;
  const act = value as Record<string, unknown>;
  return ["judgment", "risk", "question", "placeholder", "emptyHint"].every(
    (key) => typeof act[key] === "string" && (act[key] as string).trim().length > 0 && (act[key] as string).length <= 600
  );
}

function parseCoachApiResponse(value: unknown): CoachApiResponse | null {
  if (typeof value !== "object" || value === null) return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || (payload.mode !== "live" && payload.mode !== "fixture") || !isCoachAct(payload.act)) {
    return null;
  }
  return { mode: payload.mode, act: payload.act };
}

async function requestNextAct({
  entry,
  completedAct,
  answers,
  signal,
}: {
  entry: CoachEntry;
  completedAct: 0 | 1;
  answers: readonly string[];
  signal: AbortSignal;
}): Promise<CoachApiResponse> {
  const response = await fetch("/api/hub/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry, completedAct, answers }),
    signal,
  });
  if (!response.ok) throw new Error("Hub Coach request failed");
  const parsed = parseCoachApiResponse(await response.json());
  if (!parsed) throw new Error("Hub Coach response was invalid");
  return parsed;
}

/**
 * Three-scene Coach flow host. The synchronous machine remains the source of
 * truth for progression and seed composition; this component only overlays a
 * validated next-scene response after the existing visual transition.
 */
export function CoachFlow({
  entry,
  orbIdPrefix = "coach-flow",
  compact = false,
  variant = "stage",
  entryBasePath = "/start",
}: {
  entry: CoachEntry;
  orbIdPrefix?: string;
  compact?: boolean;
  variant?: "stage" | "workspace";
  entryBasePath?: "/" | "/start";
}) {
  const [state, dispatch] = useReducer(reducer, entry, createCoachState);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [remoteActs, setRemoteActs] = useState<Record<number, CoachAct>>({});
  const [providerPending, setProviderPending] = useState(false);
  const [providerMode, setProviderMode] = useState<CoachApiMode | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const seedHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestVersionRef = useRef(0);
  const submitLockRef = useRef(false);

  const transitioning = state.phase === "transition";
  const condensing = transitioning && state.actIndex === ACT_COUNT - 1;

  /* Ignore late HTTP work after unmount or a fresh attempt. */
  useEffect(() => {
    return () => {
      requestVersionRef.current += 1;
    };
  }, []);

  /**
   * Keep the current scene in place for at least the existing transition
   * duration. Only acts 0/1 ask the API; scene 2 always reaches composeSeed()
   * without a model request.
   */
  useEffect(() => {
    if (state.phase !== "transition") return;

    let active = true;
    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);
    const minimumTransition = delay(transitionMs());

    const continueFlow = async () => {
      let response: CoachApiResponse | null = null;
      let requestFailed = false;

      if (state.actIndex < ACT_COUNT - 1) {
        setProviderPending(true);
        setProviderError(null);
        try {
          response = await requestNextAct({
            entry: state.entry,
            completedAct: state.actIndex as 0 | 1,
            answers: state.answers,
            signal: controller.signal,
          });
        } catch {
          requestFailed = true;
        }
      }

      await minimumTransition;
      if (!active || requestVersion !== requestVersionRef.current) return;

      if (response) {
        setRemoteActs((acts) => ({ ...acts, [state.actIndex + 1]: response!.act }));
        setProviderMode(response.mode);
      } else if (state.actIndex < ACT_COUNT - 1) {
        setProviderMode("fixture");
        if (requestFailed && !controller.signal.aborted) setProviderError(CLIENT_FALLBACK_NOTICE);
      }

      setProviderPending(false);
      submitLockRef.current = false;
      dispatch({ type: "advance" });
    };

    void continueFlow();
    return () => {
      active = false;
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [state.actIndex, state.answers, state.entry, state.phase]);

  /** 种子出现后把焦点交给具名标题,屏幕阅读器与键盘都跟得上 */
  useEffect(() => {
    if (state.phase === "seed") {
      seedHeadingRef.current?.focus();
    }
  }, [state.phase]);

  const visual = useMemo(() => {
    if (state.phase === "question" && listening) return "listening" as const;
    return visualStateFor(state);
  }, [state, listening]);

  const fallbackAct = currentAct(state);
  const act = remoteActs[state.actIndex] ?? fallbackAct;
  const resolvedActs = actsFor(state.entry).map((fixture, index) => remoteActs[index] ?? fixture);
  const providerStatus = transitioning
    ? providerPending
      ? "AI Coach 正在整理这一幕的回答。"
      : "Coach 正在收拢这一幕的回答。"
    : providerMode === "live"
      ? "这一幕由 AI 服务根据已完成回答生成。"
      : providerMode === "fixture"
        ? "这一幕沿用确定性追问。"
        : null;

  function handleSubmit() {
    if (submitLockRef.current || transitioning || state.phase === "seed") return;
    if (!isSubmittableAnswer(answer)) {
      dispatch({ type: "submit", answer });
      return;
    }
    submitLockRef.current = true;
    dispatch({ type: "submit", answer });
    setAnswer("");
    setListening(false);
  }

  function resetFlow() {
    requestVersionRef.current += 1;
    submitLockRef.current = false;
    dispatch({ type: "reset" });
    setAnswer("");
    setListening(false);
    setRemoteActs({});
    setProviderPending(false);
    setProviderMode(null);
    setProviderError(null);
  }

  if (variant === "workspace") {
    const problemHref = entryBasePath;
    const ideaHref = `${entryBasePath}?entry=idea`;
    const seed = state.phase === "seed" ? composeSeed(state) : null;

    return (
      <div className="coach-workspace-grid coach-stage" aria-busy={transitioning || providerPending}>
        <aside className="coach-workspace-rail" aria-label="探索设置与三幕路径">
          <div>
            <p className="coach-workspace-kicker">AI Coach · 受控预览</p>
            <h1 className="coach-workspace-title">把问题压实到可验证</h1>
            <p className="coach-workspace-intro">三幕，一幕一问。回答留在当前会话，刷新后清空。</p>
          </div>

          <div className="coach-entry-switch" role="group" aria-label="选择探索入口">
            <Link
              href={problemHref}
              aria-current={state.entry === "problem" ? "true" : undefined}
              className="coach-entry-option"
            >
              真实问题
            </Link>
            <Link
              href={ideaHref}
              aria-current={state.entry === "idea" ? "true" : undefined}
              className="coach-entry-option"
            >
              已有想法
            </Link>
          </div>

          <ol className="coach-stage-list" aria-label="三幕探索路径">
            {WORKSPACE_STAGES.map((label, index) => {
              const status = state.phase === "seed" || index < state.actIndex
                ? "complete"
                : index === state.actIndex
                  ? "current"
                  : "upcoming";
              return (
                <li key={label} className="coach-stage-item" data-status={status}>
                  <span className="coach-stage-number">{String(index + 1).padStart(2, "0")}</span>
                  <span>{label}</span>
                </li>
              );
            })}
          </ol>

          <p className="coach-workspace-privacy">只保留任务所需信息。请勿输入保密、个人或未公开内容。</p>
        </aside>

        {seed ? (
          <div className="coach-workspace-dialog coach-workspace-dialog--seed">
            <div className="coach-workspace-dialog-head">
              <div>
                <p className="coach-workspace-kicker">会话结果</p>
                <p className="coach-workspace-dialog-title">问题种子已凝结</p>
              </div>
              <p className="coach-workspace-count">03 / 03</p>
            </div>
            <div className="coach-conversation-scroll" data-coach-conversation-scroll tabIndex={0}>
              <SeedCard seed={seed} headingRef={seedHeadingRef} headingId={`${orbIdPrefix}-seed-title`} />
            </div>
            <div className="coach-workspace-seed-actions">
              <button type="button" className="hub-btn hub-btn--ghost" onClick={resetFlow}>
                重新开始
              </button>
            </div>
          </div>
        ) : (
          <CoachWorkspaceScene
            act={act}
            resolvedActs={resolvedActs}
            answers={state.answers}
            actIndex={state.actIndex}
            actCount={ACT_COUNT}
            value={answer}
            error={state.error}
            transitioning={transitioning}
            pending={providerPending}
            privacyNotice={coachPrivacyNotice}
            providerStatus={providerStatus}
            providerError={providerError}
            onChange={(value) => {
              setAnswer(value);
              if (state.error) dispatch({ type: "clearError" });
              if (providerError) setProviderError(null);
            }}
            onResponderFocus={setListening}
            onSubmit={handleSubmit}
          />
        )}

        <aside className="coach-workspace-insight" aria-label="Coach 当前读法">
          <div className="coach-workspace-art">
            <CoachOrb state={visual} idPrefix={orbIdPrefix} size={270} decorative={false} />
          </div>
          <div className="coach-workspace-state-row">
            <span className="coach-workspace-state-dot" aria-hidden="true" />
            <span>{COACH_STATE_LABELS[visual]}</span>
          </div>
          {seed ? (
            <div className="coach-insight-block">
              <p className="coach-insight-label">当前结果</p>
              <p className="coach-insight-value">问题已被压实为工作瞬间、影响与 Agent 必要性。</p>
            </div>
          ) : (
            <dl className="coach-insight-list">
              <div>
                <dt>当前判断</dt>
                <dd>{act.judgment}</dd>
              </div>
              <div>
                <dt>最大风险</dt>
                <dd>{act.risk}</dd>
              </div>
            </dl>
          )}
        </aside>

        <p aria-live="polite" className="sr-only">
          {seed ? `三幕完成，已凝结为问题种子。${seedCopy.subtitle}` : providerStatus ?? act.question}
        </p>
      </div>
    );
  }

  return (
    <div className="coach-stage" aria-busy={transitioning || providerPending}>
      <div className={compact ? "flex flex-col gap-8" : "flex flex-col gap-10"}>
        <div className="flex justify-center" aria-hidden="true">
          <CoachOrb state={visual} idPrefix={orbIdPrefix} size={compact ? 150 : 190} />
        </div>

        {/* 场景更迭播报:只读当前问题,避免整幕重复朗读 */}
        <p aria-live="polite" className="sr-only">
          {state.phase === "seed"
            ? `三幕完成,已凝结为问题种子。${seedCopy.subtitle}`
            : providerStatus ?? act.question}
        </p>

        {state.phase === "seed" ? (
          <div>
            <SeedCard seed={composeSeed(state)} headingRef={seedHeadingRef} headingId={`${orbIdPrefix}-seed-title`} />
            <div className="mt-5 flex items-center gap-4">
              <button type="button" className="hub-btn hub-btn--ghost" onClick={resetFlow}>
                ↺ {seedCopy.restart}
              </button>
            </div>
          </div>
        ) : (
          <CoachScene
            act={act}
            actIndex={state.actIndex}
            actCount={ACT_COUNT}
            entryLabel={ENTRY_LABELS[state.entry]}
            value={answer}
            error={state.error}
            transitioning={transitioning}
            pending={providerPending}
            condensing={condensing}
            privacyNotice={coachPrivacyNotice}
            providerStatus={providerStatus}
            providerError={providerError}
            onChange={(value) => {
              setAnswer(value);
              if (state.error) dispatch({ type: "clearError" });
              if (providerError) setProviderError(null);
            }}
            onResponderFocus={setListening}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

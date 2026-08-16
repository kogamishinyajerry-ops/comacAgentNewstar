"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CoachOrb } from "./coach-orb";
import { CoachScene } from "./coach-scene";
import { SeedCard } from "./seed-card";
import { seedCopy, type CoachEntry } from "@/fixtures/coach-demo";
import {
  ACT_COUNT,
  advance,
  clearError,
  composeSeed,
  createCoachState,
  currentAct,
  submitAnswer,
  visualStateFor,
  type CoachState,
} from "@/lib/hub/coach-machine";

type Action =
  | { type: "submit"; answer: string }
  | { type: "advance" }
  | { type: "clearError" }
  | { type: "reset" };

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

/** transition 期满时长:默认与场景切换动效一致;减弱动态时缩短 */
function transitionMs(): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 160;
  }
  return 560;
}

/**
 * 确定性三幕 Coach 流程宿主:一幕一问一回答器,三幕后凝结问题种子。
 * 可嵌入主页模块 E,也可作为 /start 的单焦点舞台。
 */
export function CoachFlow({
  entry,
  orbIdPrefix = "coach-flow",
  compact = false,
}: {
  entry: CoachEntry;
  orbIdPrefix?: string;
  compact?: boolean;
}) {
  const [state, dispatch] = useReducer(reducer, entry, createCoachState);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const seedHeadingRef = useRef<HTMLDivElement>(null);

  const transitioning = state.phase === "transition";
  const condensing = transitioning && state.actIndex === ACT_COUNT - 1;

  /* transition 期满 → 进入下一幕或凝结出种子 */
  useEffect(() => {
    if (state.phase !== "transition") return;
    const t = setTimeout(() => dispatch({ type: "advance" }), transitionMs());
    return () => clearTimeout(t);
  }, [state.phase]);

  /* 种子出现后把焦点交给种子区,屏幕阅读器与键盘都跟得上 */
  useEffect(() => {
    if (state.phase === "seed") {
      seedHeadingRef.current?.focus();
    }
  }, [state.phase]);

  const visual = useMemo(() => {
    if (state.phase === "question" && listening) return "listening" as const;
    return visualStateFor(state);
  }, [state, listening]);

  const act = currentAct(state);

  function handleSubmit() {
    if (transitioning || state.phase === "seed") return;
    dispatch({ type: "submit", answer });
    setAnswer("");
    setListening(false);
  }

  return (
    <div className="coach-stage">
      <div className={compact ? "flex flex-col gap-8" : "flex flex-col gap-10"}>
        <div className="flex justify-center" aria-hidden="true">
          <CoachOrb state={visual} idPrefix={orbIdPrefix} size={compact ? 150 : 190} />
        </div>

        {/* 场景更迭播报:只读当前问题,避免整幕重复朗读 */}
        <p aria-live="polite" className="sr-only">
          {state.phase === "seed"
            ? `三幕完成,已凝结为问题种子。${seedCopy.subtitle}`
            : transitioning
              ? "Coach 正在收拢你的回答。"
              : act.question}
        </p>

        {state.phase === "seed" ? (
          <div ref={seedHeadingRef} tabIndex={-1} className="outline-none">
            <SeedCard seed={composeSeed(state)} />
            <div className="mt-5 flex items-center gap-4">
              <button
                type="button"
                className="hub-btn hub-btn--ghost"
                onClick={() => {
                  dispatch({ type: "reset" });
                  setAnswer("");
                }}
              >
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
            condensing={condensing}
            onChange={(v) => {
              setAnswer(v);
              if (state.error) dispatch({ type: "clearError" });
            }}
            onResponderFocus={setListening}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { site } from "@/config/site";
import type { CoachEntry } from "@/fixtures/coach-demo";
import frameStyles from "./game-grade-vertical-slice.module.css";
import journeyStyles from "./game-grade-journey.module.css";
import introStyles from "./game-grade-intro.module.css";

type IntroState = "open" | "leaving" | "closed";
type JourneyPhase = "question" | "transition" | "seed" | "artifact";

type JourneySnapshot = {
  completed: number;
  busy: boolean;
  phase: JourneyPhase;
};

const JOURNEY_STEPS = [
  {
    key: "moment",
    index: "01",
    label: "真实瞬间",
    detail: "落到一个可观察的场景",
  },
  {
    key: "impact",
    index: "02",
    label: "具体影响",
    detail: "看见谁承担了什么损失",
  },
  {
    key: "necessity",
    index: "03",
    label: "Agent 必要性",
    detail: "证明为什么简单方式不足",
  },
] as const;

const INITIAL_SNAPSHOT: JourneySnapshot = {
  completed: 0,
  busy: false,
  phase: "question",
};

function clampCompleted(value: number): number {
  return Math.max(0, Math.min(JOURNEY_STEPS.length, value));
}

/**
 * 体验层只读取既有 Coach 的公开 DOM 状态，不保存第二份业务状态，
 * 也不决定流程推进；真实状态机仍是唯一事实源。
 */
function readSnapshot(scope: HTMLElement): JourneySnapshot {
  const workspace = scope.querySelector<HTMLElement>(".coach-workspace-grid");
  const progress = scope.querySelector<HTMLElement>("[data-coach-progress]");
  const progressLabel = progress?.getAttribute("aria-label") ?? "";
  const match = progressLabel.match(/已沉淀\s*(\d+)\s*\/\s*3/);
  const filledSlots = scope.querySelectorAll(
    '[data-coach-slot-filled="true"]',
  ).length;
  const grown =
    workspace?.classList.contains("coach-workspace-grid--grown") ?? false;
  // 深化轮期间没有 --grown 也没有 data-artifact-lit,但问题卡的深化区在;
  // 必须读它,否则三轮深化中 journey 会回退到第二幕的旧状态。
  const artifact =
    Boolean(scope.querySelector("[data-artifact-lit]")) ||
    Boolean(scope.querySelector("[data-coach-progress-deepening]"));
  const completed =
    grown || artifact
      ? JOURNEY_STEPS.length
      : clampCompleted(match ? Number(match[1]) : filledSlots);
  const busy = workspace?.getAttribute("aria-busy") === "true";

  return {
    completed,
    busy,
    phase: artifact
      ? "artifact"
      : grown
        ? "seed"
        : busy
          ? "transition"
          : "question",
  };
}

function snapshotsMatch(a: JourneySnapshot, b: JourneySnapshot): boolean {
  return (
    a.completed === b.completed &&
    a.busy === b.busy &&
    a.phase === b.phase
  );
}

function statusCopy(snapshot: JourneySnapshot): string {
  if (snapshot.busy) return "Coach 正在重排线索";
  if (snapshot.phase === "artifact") return "问题种子已进入第一份 Artifact";
  if (snapshot.phase === "seed") return "问题种子已凝结";
  if (snapshot.completed === 0) return "等待第一条真实线索";
  if (snapshot.completed === 1) return "真实瞬间已沉淀";
  if (snapshot.completed === 2) return "影响关系已显现";
  return "Agent 必要性已形成";
}

function stepState(
  index: number,
  snapshot: JourneySnapshot,
): "complete" | "current" | "future" {
  if (index < snapshot.completed) return "complete";
  if (
    snapshot.completed < JOURNEY_STEPS.length &&
    index === snapshot.completed
  ) {
    return "current";
  }
  return "future";
}

export function GameGradeVerticalSlice({
  entry,
  children,
}: {
  entry: CoachEntry;
  children: ReactNode;
}) {
  const [introState, setIntroState] = useState<IntroState>("open");
  const [snapshot, setSnapshot] =
    useState<JourneySnapshot>(INITIAL_SNAPSHOT);
  const stageRef = useRef<HTMLDivElement>(null);
  const journeyRef = useRef<HTMLElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const exitTimerRef = useRef<number | null>(null);

  const introActive = introState !== "closed";
  const status = useMemo(() => statusCopy(snapshot), [snapshot]);
  const switchHref =
    entry === "problem" ? "/experience?entry=idea" : "/experience";
  const switchLabel =
    entry === "problem"
      ? "改从已有想法开始"
      : "改从一个真实问题开始";
  const entryLabel =
    entry === "problem" ? "真实问题入口" : "已有想法入口";

  const beginExperience = useCallback(() => {
    if (introState !== "open") return;
    setIntroState("leaving");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    exitTimerRef.current = window.setTimeout(
      () => setIntroState("closed"),
      reduceMotion ? 0 : 620,
    );
  }, [introState]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const journey = journeyRef.current;
    if (!stage || !journey) return;

    // 序章拥有唯一场景:stage 与 journey 一并隔离,
    // 否则透明度为 0 的换入口链接仍可被 Tab/读屏到达。
    if (introActive) {
      stage.setAttribute("inert", "");
      journey.setAttribute("inert", "");
    } else {
      stage.removeAttribute("inert");
      journey.removeAttribute("inert");
    }
  }, [introActive]);

  useEffect(() => {
    if (introState !== "open") return;
    const frame = window.requestAnimationFrame(() => startRef.current?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      beginExperience();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [beginExperience, introState]);

  useEffect(() => {
    if (introState !== "closed") return;
    const frame = window.requestAnimationFrame(() => {
      stageRef.current
        ?.querySelector<HTMLElement>("#coach-answer")
        ?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [introState]);

  useEffect(() => {
    const scope = stageRef.current;
    if (!scope) return;

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = readSnapshot(scope);
        setSnapshot((current) =>
          snapshotsMatch(current, next) ? current : next,
        );
      });
    };

    const observer = new MutationObserver(update);
    observer.observe(scope, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true,
      attributeFilter: [
        "aria-busy",
        "aria-label",
        "class",
        "data-artifact-lit",
        "data-coach-slot-filled",
      ],
    });
    update();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      className={frameStyles.root}
      data-game-grade-slice
      data-intro-state={introState}
      data-journey-phase={snapshot.phase}
      data-journey-completed={snapshot.completed}
      aria-label="Game-grade 问题探索体验"
    >
      <div
        className={frameStyles.world}
        data-completed={snapshot.completed}
        data-phase={snapshot.phase}
        aria-hidden="true"
      >
        <span className={`${frameStyles.worldNode} ${frameStyles.worldNodeOne}`} />
        <span className={`${frameStyles.worldNode} ${frameStyles.worldNodeTwo}`} />
        <span className={`${frameStyles.worldNode} ${frameStyles.worldNodeThree}`} />
        <span className={frameStyles.worldArc} />
        <span className={frameStyles.worldCore} />
      </div>

      <aside
        ref={journeyRef}
        className={journeyStyles.journey}
        data-game-grade-journey
        data-busy={snapshot.busy}
        aria-hidden={introActive}
        aria-label={`问题种子形成轨迹：${status}`}
      >
        <div className={journeyStyles.journeyIdentity}>
          <span className={journeyStyles.journeyEyebrow}>问题正在形成</span>
          <strong className={journeyStyles.journeyStatus}>{status}</strong>
        </div>

        <ol className={journeyStyles.journeyTrack}>
          {JOURNEY_STEPS.map((step, index) => {
            const state = stepState(index, snapshot);
            return (
              <li
                key={step.key}
                className={journeyStyles.journeyStep}
                data-game-grade-step={step.key}
                data-state={state}
              >
                <span className={journeyStyles.journeyMarker} aria-hidden="true">
                  {state === "complete" ? "✓" : step.index}
                </span>
                <span className={journeyStyles.journeyStepCopy}>
                  <span className={journeyStyles.journeyStepLabel}>{step.label}</span>
                  <span className={journeyStyles.journeyStepDetail}>{step.detail}</span>
                </span>
              </li>
            );
          })}
        </ol>

        <div className={journeyStyles.journeyMode}>
          <span>{entryLabel}</span>
          <Link href={switchHref} className={journeyStyles.modeLink}>
            {switchLabel}
          </Link>
        </div>
      </aside>

      <div
        ref={stageRef}
        className={frameStyles.stage}
        data-game-grade-stage
        aria-hidden={introActive}
      >
        {children}
      </div>

      {introState !== "closed" && (
        <section
          className={introStyles.intro}
          data-game-grade-intro
          data-state={introState}
          aria-labelledby="game-grade-intro-title"
          aria-describedby="game-grade-intro-description"
        >
          <div className={introStyles.introBackdrop} aria-hidden="true" />
          <div className={introStyles.introPanel}>
            <div className={introStyles.introCopy}>
              <p className={introStyles.introKicker}>
                <span>INTERACTIVE PROLOGUE</span>
                <span aria-hidden="true">/</span>
                <span>体验序章 01</span>
              </p>
              <h1 id="game-grade-intro-title" className={introStyles.introTitle}>
                让一个真实问题，
                <span>自己长出结构。</span>
              </h1>
              <p
                id="game-grade-intro-description"
                className={introStyles.introLead}
              >
                这不是答题闯关。你每交出一个判断，空间只多长出一层：
                真实瞬间、具体影响、Agent 必要性。
              </p>
              <div className={introStyles.introActions}>
                <button
                  ref={startRef}
                  type="button"
                  className={introStyles.startButton}
                  onClick={beginExperience}
                >
                  <span>唤醒问题</span>
                  <span className={introStyles.startButtonMark} aria-hidden="true">
                    →
                  </span>
                </button>
                <Link href="/start" className={introStyles.simpleModeLink}>
                  直接进入简洁模式
                </Link>
              </div>
              <p className={introStyles.introFootnote}>
                无积分 · 无排行 · 不替你做判断
              </p>
            </div>

            <div
              className={introStyles.seedStage}
              data-game-grade-seed
              aria-hidden="true"
            >
              <div className={introStyles.seedCoordinate}>
                <span className={introStyles.seedAxisHorizontal} />
                <span className={introStyles.seedAxisVertical} />
                <span
                  className={`${introStyles.seedMembrane} ${introStyles.seedMembraneOne}`}
                />
                <span
                  className={`${introStyles.seedMembrane} ${introStyles.seedMembraneTwo}`}
                />
                <span
                  className={`${introStyles.seedMembrane} ${introStyles.seedMembraneThree}`}
                />
                <span className={introStyles.seedCore}>
                  <span className={introStyles.seedCoreInner} />
                </span>
                <span className={`${introStyles.seedSignal} ${introStyles.seedSignalOne}`}>
                  真实瞬间
                </span>
                <span className={`${introStyles.seedSignal} ${introStyles.seedSignalTwo}`}>
                  具体影响
                </span>
                <span
                  className={`${introStyles.seedSignal} ${introStyles.seedSignalThree}`}
                >
                  Agent 必要性
                </span>
              </div>
              <p className={introStyles.seedCaption}>
                三次判断，不是三道题。
                <span>它们会凝结成你愿意继续验证的问题种子。</span>
              </p>
            </div>
          </div>

          <div className={introStyles.introMeta}>
            <span>{site.brand.name}</span>
            <span>按 Esc 也可进入</span>
          </div>
        </section>
      )}

      <p className="sr-only" aria-live="polite">
        {introState === "closed"
          ? `体验序章结束。${status}。当前可以回答 AI Coach 的唯一问题。`
          : "体验序章已打开。选择唤醒问题，或进入简洁模式。"}
      </p>
    </section>
  );
}

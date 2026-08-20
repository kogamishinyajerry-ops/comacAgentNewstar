"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { CoachEntry } from "@/fixtures/coach-demo";
import {
  deriveGameGradeTrace,
  GAME_GRADE_TRACE_STEPS,
  type GameGradeTraceSnapshot,
} from "@/lib/hub/game-grade-experience";
import { CoachOrb } from "./coach-orb";
import { CoachWorkbench } from "./coach-workbench";
import styles from "./game-grade-experience.module.css";

const INTRO_EXIT_MS = 520;

function sameTrace(
  left: GameGradeTraceSnapshot,
  right: GameGradeTraceSnapshot,
): boolean {
  return (
    left.completedCount === right.completedCount &&
    left.status === right.status &&
    left.statusLabel === right.statusLabel
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return reduced;
}

function WorldTrace({ snapshot }: { snapshot: GameGradeTraceSnapshot }) {
  return (
    <header
      className={styles.worldTrace}
      data-world-trace
      data-world-status={snapshot.status}
      aria-label={`问题种子形成轨迹：${snapshot.statusLabel}`}
    >
      <div className={styles.traceCopy}>
        <span className={styles.traceEyebrow}>问题世界</span>
        <p className={styles.traceStatus} aria-live="polite">
          {snapshot.statusLabel}
        </p>
      </div>

      <ol className={styles.traceNodes} aria-label="构成问题种子的三个判断">
        {snapshot.nodes.map((node, index) => (
          <li
            key={node.key}
            className={styles.traceNode}
            data-world-node={node.key}
            data-world-state={node.state}
            aria-current={node.state === "current" ? "step" : undefined}
          >
            <span className={styles.traceDot} aria-hidden="true">
              {node.state === "filled" ? "✓" : index + 1}
            </span>
            <span className={styles.traceLabel}>{node.label}</span>
            {index < GAME_GRADE_TRACE_STEPS.length - 1 && (
              <span className={styles.traceConnector} aria-hidden="true" />
            )}
          </li>
        ))}
      </ol>
    </header>
  );
}

export function GameGradeExperience({ entry }: { entry: CoachEntry }) {
  const reducedMotion = useReducedMotion();
  const [introOpen, setIntroOpen] = useState(true);
  const [introClosing, setIntroClosing] = useState(false);
  const [trace, setTrace] = useState<GameGradeTraceSnapshot>(() =>
    deriveGameGradeTrace({
      completedCount: 0,
      transitioning: false,
      confirmed: false,
    }),
  );
  const workbenchRef = useRef<HTMLDivElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  const simpleModeHref = useMemo(
    () => (entry === "idea" ? "/start?entry=idea" : "/start"),
    [entry],
  );

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const workbench = workbenchRef.current;
    if (!workbench) return;

    if (introOpen) {
      workbench.setAttribute("inert", "");
      workbench.setAttribute("aria-hidden", "true");
      window.requestAnimationFrame(() => primaryActionRef.current?.focus());
      return;
    }

    workbench.removeAttribute("inert");
    workbench.removeAttribute("aria-hidden");
    window.requestAnimationFrame(() => {
      workbench.querySelector<HTMLTextAreaElement>("#coach-answer")?.focus();
    });
  }, [introOpen]);

  useEffect(() => {
    const root = workbenchRef.current;
    if (!root) return;

    const syncTrace = () => {
      const completedCount = GAME_GRADE_TRACE_STEPS.filter((step) =>
        root.querySelector(
          `[data-coach-slot="${step.key}"][data-coach-slot-filled="true"]`,
        ),
      ).length;
      const coachGrid = root.querySelector<HTMLElement>(".coach-workspace-grid");
      const transitioning = coachGrid?.getAttribute("aria-busy") === "true";
      const confirmed = Boolean(
        root.querySelector(".coach-workspace-grid--grown"),
      );
      const next = deriveGameGradeTrace({
        completedCount,
        transitioning,
        confirmed,
      });
      setTrace((current) => (sameTrace(current, next) ? current : next));
    };

    syncTrace();
    const observer = new MutationObserver(syncTrace);
    observer.observe(root, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  function finishIntro() {
    if (!introOpen || introClosing) return;
    if (reducedMotion) {
      setIntroOpen(false);
      return;
    }
    setIntroClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIntroOpen(false);
      setIntroClosing(false);
      closeTimerRef.current = null;
    }, INTRO_EXIT_MS);
  }

  function handlePrologueKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      finishIntro();
      return;
    }
    if (event.key !== "Tab") return;

    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusables.length < 2) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleWorkbenchClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (href !== "/start" && href !== "/start?entry=idea") return;

    event.preventDefault();
    const experienceHref = href.replace(/^\/start/, "/experience");
    window.location.assign(experienceHref);
  }

  return (
    <section
      className={styles.shell}
      data-game-grade-experience
      data-experience-entry={entry}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      aria-label="沉浸式 AI Coach 问题探索"
    >
      <WorldTrace snapshot={trace} />

      <div
        ref={workbenchRef}
        className={styles.workbench}
        onClickCapture={handleWorkbenchClickCapture}
      >
        <CoachWorkbench entry={entry} entryBasePath="/start" />
      </div>

      {introOpen && (
        <div
          className={styles.prologue}
          data-experience-prologue
          data-intro-state={introClosing ? "closing" : "open"}
          role="dialog"
          aria-modal="true"
          aria-labelledby="experience-prologue-title"
          aria-describedby="experience-prologue-copy"
          onKeyDown={handlePrologueKeyDown}
        >
          <div className={styles.prologueAtmosphere} aria-hidden="true" />
          <div className={styles.prologuePanel}>
            <div className={styles.prologueVisual} aria-hidden="true">
              <span className={styles.prologueOrbit} />
              <CoachOrb
                state="idle"
                idPrefix="experience-prologue"
                size={236}
                className={styles.prologueOrb}
              />
            </div>

            <div className={styles.prologueCopy}>
              <p className={styles.prologueEyebrow}>沉浸式问题探索</p>
              <h1 id="experience-prologue-title" className={styles.prologueTitle}>
                每一次判断，都会让问题世界多长出一层结构
              </h1>
              <p id="experience-prologue-copy" className={styles.prologueBody}>
                这里没有积分，也不会替你作答。AI Coach 每次只追问一个关键问题；三次判断后，它们会凝结成一枚可以带走的问题种子。
              </p>

              <div className={styles.prologueRules} aria-label="体验规则">
                <span>一个问题</span>
                <span>一个判断</span>
                <span>一次可见后果</span>
              </div>

              <div className={styles.prologueActions}>
                <button
                  ref={primaryActionRef}
                  type="button"
                  className={styles.primaryAction}
                  onClick={finishIntro}
                >
                  唤醒问题
                  <span aria-hidden="true">→</span>
                </button>
                <Link href={simpleModeHref} className={styles.simpleModeLink}>
                  直接进入简洁模式
                </Link>
              </div>

              <p className={styles.prologueNote}>
                无声音 · 可随时跳过 · 当前探索只在本次会话内沉淀
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

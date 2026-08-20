"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { COACH_STATE_LABELS } from "./coach-orb";
import { CoachWorkspaceScene, type CoachTransitionStep } from "./coach-workspace-scene";
import { CoachMiniCard } from "./coach-mini-card";
import { CoachReviewDrawer } from "./coach-review-drawer";
import { SeedCard } from "./seed-card";
import { ArtifactCard } from "./artifact-card";
import {
  artifactCopy,
  attachmentPrivacyNotice,
  coachPrivacyNotice,
  coachProgressCopy,
  seedCopy,
  type CoachAct,
  type CoachEntry,
} from "@/fixtures/coach-demo";
import {
  validateCoachAttachment,
  type CoachAttachment,
} from "@/lib/hub/coach-attachment";
import {
  ARTIFACT_ROUND_COUNT,
  ACT_COUNT,
  advance,
  artifactActsFor,
  actsFor,
  clearError,
  composeArtifact,
  composeReviewRounds,
  composeSeed,
  createCoachState,
  createSessionCardId,
  currentAct,
  isSubmittableAnswer,
  miniSlots,
  returnToSeed,
  startArtifact,
  submitAnswer,
  TRACE_LABELS,
  visualStateFor,
  type CoachState,
  type ExportMeta,
} from "@/lib/hub/coach-machine";

type Action =
  | { type: "submit"; answer: string }
  | { type: "advance" }
  | { type: "clearError" }
  | { type: "startArtifact" }
  | { type: "returnToSeed" }
  | { type: "reset" };

type CoachApiMode = "live" | "fixture";

interface CoachApiResponse {
  mode: CoachApiMode;
  /** 路由层限流超限的 fixture 信号不带 act,客户端回落本地确定性 fixture */
  act: CoachAct | null;
}

function reducer(state: CoachState, action: Action): CoachState {
  switch (action.type) {
    case "submit":
      return submitAnswer(state, action.answer);
    case "advance":
      return advance(state);
    case "clearError":
      return clearError(state);
    case "startArtifact":
      return startArtifact(state);
    case "returnToSeed":
      return returnToSeed(state);
    case "reset":
      return createCoachState(state.entry);
  }
}

const CLIENT_FALLBACK_NOTICE = "AI 服务暂不可用，本幕已按确定性追问继续。";
const CLIENT_REQUEST_TIMEOUT_MS = 100_000;

/** 种子长出后 Artifacts 的图标入口(下一阶段能力预告,默认仅图标) */
const ARTIFACT_SLOTS = [
  { label: "问题定义", icon: "▤" },
  { label: "用户与场景", icon: "◍" },
  { label: "Agent 方案", icon: "⧉" },
  { label: "验证计划", icon: "◇" },
] as const;

/** transition 期满时长:默认与场景切换动效一致;减弱动态时缩短 */
function transitionMs(): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 160;
  }
  /* 与 tokens.css 的 --dur-scene(540ms)保持一致,消除双维护漂移(§21) */
  return 540;
}

/** 判断/风险每一拍的停留时长:动画下限之上按可见字符数给足阅读时间;
    减弱动态只缩短动画下限,不剥夺阅读时间(live 文案可达 72 字) */
function stepMs(text?: string): number {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const floor = reduce ? 220 : 1150;
  if (!text) return floor;
  return Math.max(floor, Math.ceil(text.replace(/\s/g, "").length * 140));
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
  if (payload.ok !== true || (payload.mode !== "live" && payload.mode !== "fixture")) return null;
  if (payload.mode === "live") {
    /* live 必须携带完整且合法的 act;缺失即整体无效,走本地回退 */
    return isCoachAct(payload.act) ? { mode: "live", act: payload.act } : null;
  }
  return { mode: "fixture", act: isCoachAct(payload.act) ? payload.act : null };
}

async function requestNextAct({
  entry,
  completedAct,
  answers,
  attachment,
  artifact,
  signal,
}: {
  entry: CoachEntry;
  completedAct: 0 | 1;
  answers: readonly string[];
  /** 随当前回答一次性发送的不可信文本附件;不持久化、不写日志 */
  attachment?: CoachAttachment | null;
  /** 第四幕深化请求(与 acts 请求体互斥;不携带附件) */
  artifact?: {
    round: 0 | 1;
    seed: { moment: string; impact: string; necessity: string };
    answers: readonly string[];
  };
  signal: AbortSignal;
}): Promise<CoachApiResponse> {
  const response = await fetch("/api/hub/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      artifact
        ? {
            entry,
            seed: artifact.seed,
            artifactRound: artifact.round,
            artifactAnswers: artifact.answers,
          }
        : {
            entry,
            completedAct,
            answers,
            ...(attachment ? { attachment } : {}),
          }
    ),
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
  entryBasePath = "/start",
}: {
  entry: CoachEntry;
  orbIdPrefix?: string;
  entryBasePath?: "/" | "/start";
}) {
  const [state, dispatch] = useReducer(reducer, entry, createCoachState);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [remoteActs, setRemoteActs] = useState<Record<number, CoachAct>>({});
  const [artifactRemoteActs, setArtifactRemoteActs] = useState<Record<number, CoachAct>>({});
  const [providerPending, setProviderPending] = useState(false);
  const [providerMode, setProviderMode] = useState<CoachApiMode | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [transitionStep, setTransitionStep] = useState<CoachTransitionStep | null>(null);
  const [attachment, setAttachment] = useState<CoachAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentReading, setAttachmentReading] = useState(false);
  /* 打磨轮⑥:回看抽屉开态;关闭时焦点回触发器 */
  const [reviewOpen, setReviewOpen] = useState(false);
  /* 刚沉淀的槽位 key(保留到下次提交/重置):小卡高亮 + sr-only 播报用 */
  const [justFilledKey, setJustFilledKey] = useState<string | null>(null);
  const seedHeadingRef = useRef<HTMLHeadingElement>(null);
  const seedScrollRef = useRef<HTMLDivElement>(null);
  const artifactHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestVersionRef = useRef(0);
  const submitLockRef = useRef(false);
  /* 附件异步读取的失效令牌:新选择/移除/提交/换幕/重置都会作废旧读取,
     迟到的 file.text() 结果不得回写为 Chip */
  const attachmentReadTokenRef = useRef(0);
  /* 提交瞬间的附件快照:transition effect 从 ref 读取,
     避免 effect 闭包捕获与 exhaustive-deps 压力(与 requestVersionRef 同策) */
  const attachmentRef = useRef<CoachAttachment | null>(null);
  /* 等待期可取消:持有当前过渡请求的 AbortController,
     用户取消即中止在途请求、立即改用本地确定性追问 */
  const waitAbortRef = useRef<AbortController | null>(null);
  /* P0-1(§31 H1):会话随机卡号一次/会话;种子与问题定义首次凝结时各捕一次
     本地时钟——导出文本的"生成时间"是凝结时刻,不是点击复制的时刻 */
  const cardIdRef = useRef<string | null>(null);
  if (cardIdRef.current === null) cardIdRef.current = createSessionCardId();
  const seedAtRef = useRef<Date | null>(null);
  const artifactAtRef = useRef<Date | null>(null);

  const artifactStage = state.phase === "artifact-question" || state.phase === "artifact-transition" || state.phase === "artifact-done";
  const transitioning = state.phase === "transition" || state.phase === "artifact-transition";
  const condensing =
    transitioning &&
    (artifactStage
      ? state.artifactRound >= ARTIFACT_ROUND_COUNT - 1
      : state.actIndex >= ACT_COUNT - 1);

  /* Ignore late HTTP work after unmount or a fresh attempt. */
  useEffect(() => {
    return () => {
      requestVersionRef.current += 1;
    };
  }, []);

  /* 深化轮请求携带的种子快照:纯函数派生,只随三幕回答变化;提升出过渡 effect 以收敛依赖 */
  const artifactSeed = useMemo(() => composeSeed(state), [state]);

  /**
   * 幕间/深化轮时序:收拢(collect)→ 当前判断 → 最大风险 → 下一问。
   * 判断/风险只在下一幕(轮)内容确定后(live 成功或静默回退 fixture)逐拍端上,
   * 不与下一问长期并列;末幕与末深化轮不再请求模型,直接凝结(种子/问题定义)。
   */
  useEffect(() => {
    if (state.phase !== "transition" && state.phase !== "artifact-transition") {
      setTransitionStep(null);
      return;
    }

    const isArtifact = state.phase === "artifact-transition";
    const condensingFinal = isArtifact
      ? state.artifactRound >= ARTIFACT_ROUND_COUNT - 1
      : state.actIndex >= ACT_COUNT - 1;

    let active = true;
    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    waitAbortRef.current = controller;
    const requestTimeout = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);
    const minimumTransition = delay(transitionMs());

    const continueFlow = async () => {
      let response: CoachApiResponse | null = null;
      let requestFailed = false;

      setTransitionStep("collect");
      if (!condensingFinal) {
        setProviderPending(true);
        setProviderError(null);
        try {
          if (isArtifact) {
            /* 深化轮请求携带种子三槽摘录与已完成深化回答;不携带附件 */
            const seedSnapshot = artifactSeed;
            response = await requestNextAct({
              entry: state.entry,
              completedAct: 0,
              answers: [],
              artifact: {
                round: state.artifactRound as 0 | 1,
                seed: {
                  moment: seedSnapshot.moment,
                  impact: seedSnapshot.impact,
                  necessity: seedSnapshot.necessity,
                },
                answers: state.artifactAnswers,
              },
              signal: controller.signal,
            });
          } else {
            response = await requestNextAct({
              entry: state.entry,
              completedAct: state.actIndex as 0 | 1,
              answers: state.answers,
              attachment: attachmentRef.current,
              signal: controller.signal,
            });
          }
        } catch {
          requestFailed = true;
        }
      }

      await minimumTransition;
      if (!active || requestVersion !== requestVersionRef.current) return;

      /* 附件只随本轮回答一次性发送:响应落定(成功、回退或无需请求的凝结)
         后清空 Chip 与快照,不跨幕残留;同时作废可能仍在途的附件读取 */
      attachmentRef.current = null;
      attachmentReadTokenRef.current += 1;
      setAttachment(null);
      setAttachmentError(null);
      setAttachmentReading(false);

      if (response) {
        if (response.act) {
          if (isArtifact) {
            setArtifactRemoteActs((acts) => ({
              ...acts,
              [state.artifactRound + 1]: response.act!,
            }));
          } else {
            setRemoteActs((acts) => ({ ...acts, [state.actIndex + 1]: response.act! }));
          }
        }
        setProviderMode(response.mode);
      } else if (!condensingFinal) {
        setProviderMode("fixture");
        if (requestFailed && !controller.signal.aborted) setProviderError(CLIENT_FALLBACK_NOTICE);
      }

      setProviderPending(false);

      /* 判断 → 风险:同一幕(轮)内容的两拍,每拍单独出现、单独退出;
         停留时长按该拍真实文案的阅读时间自适应(live 长文案不再即焚) */
      if (!condensingFinal) {
        const dwellAct = response?.act
          ?? (isArtifact
            ? artifactActsFor()[state.artifactRound + 1]
            : actsFor(state.entry)[state.actIndex + 1]);
        setTransitionStep("judgment");
        await delay(stepMs(dwellAct.judgment));
        if (!active || requestVersion !== requestVersionRef.current) return;
        setTransitionStep("risk");
        await delay(stepMs(dwellAct.risk));
        if (!active || requestVersion !== requestVersionRef.current) return;
      }

      submitLockRef.current = false;
      dispatch({ type: "advance" });
    };

    void continueFlow();
    return () => {
      active = false;
      window.clearTimeout(requestTimeout);
      controller.abort();
      if (waitAbortRef.current === controller) waitAbortRef.current = null;
    };
  }, [state.actIndex, state.answers, state.entry, state.phase, state.artifactRound, state.artifactAnswers, artifactSeed]);

  /** 种子/问题定义出现后焦点落在具名标题;以标题自身 scrollIntoView 保持可见,
      不再先聚焦标题再把容器滚到底(获焦元素不得被滚出可视区域) */
  useEffect(() => {
    if (state.phase !== "seed" && state.phase !== "artifact-done") return;
    const heading = state.phase === "seed" ? seedHeadingRef.current : artifactHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [state.phase]);

  /* P0-1:首次凝结时刻的本地时钟捕获——导出"生成时间"的诚实来源;
     点击复制只是读出,不再重新取时 */
  useEffect(() => {
    if (state.phase === "seed" && seedAtRef.current === null) seedAtRef.current = new Date();
    if (state.phase === "artifact-done" && artifactAtRef.current === null) {
      artifactAtRef.current = new Date();
    }
  }, [state.phase]);

  const visual = useMemo(() => {
    if ((state.phase === "question" || state.phase === "artifact-question") && listening) {
      return "listening" as const;
    }
    return visualStateFor(state);
  }, [state, listening]);

  const fallbackAct = currentAct(state);
  const act = remoteActs[state.actIndex] ?? fallbackAct;
  const resolvedActs = actsFor(state.entry).map((fixture, index) => remoteActs[index] ?? fixture);
  const artifactFallbackActs = artifactActsFor();
  const artifactAct =
    state.artifactRound < ARTIFACT_ROUND_COUNT
      ? (artifactRemoteActs[state.artifactRound] ?? artifactFallbackActs[state.artifactRound])
      : artifactFallbackActs[ARTIFACT_ROUND_COUNT - 1];
  const artifactNextAct =
    state.artifactRound < ARTIFACT_ROUND_COUNT - 1
      ? (artifactRemoteActs[state.artifactRound + 1] ?? artifactFallbackActs[state.artifactRound + 1])
      : null;
  /* 深化轮轨迹退役(§29 G6):压缩上下文由常驻小卡承接,完整回看由抽屉承接 */
  const providerStatus = transitioning
    ? null
    : providerMode === "live"
      ? "这一幕由 AI 服务根据已完成回答生成。"
      : providerMode === "fixture"
        ? "这一幕沿用确定性追问。"
        : null;

  function handleSubmit() {
    if (
      submitLockRef.current ||
      transitioning ||
      state.phase === "seed" ||
      state.phase === "artifact-done" ||
      attachmentReading
    ) {
      return;
    }
    if (!isSubmittableAnswer(answer)) {
      dispatch({ type: "submit", answer });
      return;
    }
    submitLockRef.current = true;
    /* 快照当前附件:随本次回答在 transition effect 中一次性发送;
       同时作废读取令牌,提交后不允许任何在途读取回写(深化轮无附件入口,快照恒为空) */
    attachmentRef.current = attachment;
    attachmentReadTokenRef.current += 1;
    /* 打磨轮⑥:标记刚沉淀的槽位——回答在提交瞬间即写入状态机,
       小卡立即可见"你的回答去了哪里",不必等模型返回 */
    setJustFilledKey(
      artifactStage
        ? `deepening-${Math.min(state.artifactRound, ARTIFACT_ROUND_COUNT - 1)}`
        : (["moment", "impact", "necessity"] as const)[
            Math.min(state.actIndex, ACT_COUNT - 1)
          ],
    );
    dispatch({ type: "submit", answer });
    setAnswer("");
    setListening(false);
  }

  /** 读取并校验文本附件;失败只留行内错误,不出现 Chip。
      读取期间持有令牌:新选择/移除/提交/换幕/重置后,迟到的读取结果直接丢弃 */
  async function handleAttachmentSelect(file: File) {
    /* 第三幕只在客户端凝结种子,不开放附件入口(防御性兜底,UI 已不渲染);
       深化轮同样不开放附件 */
    if (artifactStage || state.actIndex >= ACT_COUNT - 1) return;
    const readToken = ++attachmentReadTokenRef.current;
    setAttachmentReading(true);
    let content: string;
    try {
      content = await file.text();
    } catch {
      if (readToken === attachmentReadTokenRef.current) {
        setAttachment(null);
        setAttachmentError("附件读取失败，请重新选择文件。");
        setAttachmentReading(false);
      }
      return;
    }
    if (readToken !== attachmentReadTokenRef.current) return;
    setAttachmentReading(false);
    const candidate: CoachAttachment = { name: file.name, size: file.size, content };
    const problem = validateCoachAttachment(candidate);
    if (problem) {
      setAttachment(null);
      setAttachmentError(problem);
      return;
    }
    setAttachment(candidate);
    setAttachmentError(null);
  }

  function handleAttachmentRemove() {
    attachmentReadTokenRef.current += 1;
    setAttachment(null);
    setAttachmentError(null);
    setAttachmentReading(false);
    attachmentRef.current = null;
  }

  /** 等待期取消:中止在途请求,本幕立即改用本地确定性追问;
      用户主动取消不是错误,不触发断网式回退告警(signal.aborted 已防) */
  function handleCancelWait() {
    waitAbortRef.current?.abort();
  }

  function resetFlow() {
    requestVersionRef.current += 1;
    submitLockRef.current = false;
    attachmentReadTokenRef.current += 1;
    dispatch({ type: "reset" });
    setAnswer("");
    setListening(false);
    setRemoteActs({});
    setArtifactRemoteActs({});
    setProviderPending(false);
    setProviderMode(null);
    setProviderError(null);
    setTransitionStep(null);
    setAttachment(null);
    setAttachmentError(null);
    setAttachmentReading(false);
    attachmentRef.current = null;
    setJustFilledKey(null);
    setReviewOpen(false);
    /* P0-1:重新开始=新会话——新卡号,凝结时刻重捕 */
    cardIdRef.current = createSessionCardId();
    seedAtRef.current = null;
    artifactAtRef.current = null;
  }

  const seed = state.phase === "seed" ? composeSeed(state) : null;
  const artifactDone = state.phase === "artifact-done" ? composeArtifact(state) : null;
  const grown = Boolean(seed || artifactDone);
  const backHref = "/guide";
  /* P0-1:导出可追述元信息——卡号会话级不变,时间是首次凝结时刻(兜底当前时钟,
     仅在 effect 尚未落时的理论首帧;复制动作必然晚于凝结 effect) */
  const seedMeta: ExportMeta = {
    generatedAt: seedAtRef.current ?? new Date(),
    cardId: cardIdRef.current,
  };
  const artifactMeta: ExportMeta = {
    generatedAt: artifactAtRef.current ?? new Date(),
    cardId: cardIdRef.current,
  };
  /* 打磨轮⑥派生:常驻小卡、回看数据、当前轮标记、指南出口的阶段性行为 */
  const progressSlots = miniSlots(state);
  const reviewRounds = composeReviewRounds(
    state,
    resolvedActs.map((item) => item.question),
    artifactFallbackActs.map(
      (fixture, index) => artifactRemoteActs[index]?.question ?? fixture.question,
    ),
  );
  const currentRoundLabel =
    state.phase === "question"
      ? `第 ${state.actIndex + 1} 幕 · ${TRACE_LABELS[state.actIndex] ?? ""}`
      : state.phase === "artifact-question"
        ? `深化 ${state.artifactRound + 1} · ${
            artifactCopy.dimensionLabels[Math.min(state.artifactRound, ARTIFACT_ROUND_COUNT - 1)]
          }`
        : null;
  const flowBackHref =
    state.phase === "question" && state.actIndex === 0 && state.answers.length === 0
      ? backHref
      : null;
  const justFilledLabel =
    progressSlots.find((slot) => slot.key === justFilledKey)?.label ?? null;
  const switchEntryHref = state.entry === "problem" ? `${entryBasePath}?entry=idea` : entryBasePath;
  const switchEntryLabel = state.entry === "problem" ? "换一条入口:从已有想法开始" : "换一条入口:从真实问题开始";
  const nextAct = state.actIndex < ACT_COUNT - 1 ? resolvedActs[state.actIndex + 1] : null;
  /* 深化已全部完成时,第一格常亮;尚未完成时为可开始/可继续的入口 */
  const artifactLit = state.artifactAnswers.length >= ARTIFACT_ROUND_COUNT;

  return (
    <div
      className={`coach-workspace-grid coach-stage${grown ? " coach-workspace-grid--grown" : " coach-workspace-grid--duo"}`}
      aria-busy={transitioning || providerPending}
    >
      {grown ? (
        /* 状态 D:问题种子/问题定义凝结后,工作空间才长出来 */
        <div className="coach-grown">
          <div className="coach-topbar">
            <button
              type="button"
              className="coach-topbar-back hub-quiet-link"
              data-coach-review-trigger
              aria-expanded={reviewOpen}
              onClick={() => setReviewOpen(true)}
            >
              ← {coachProgressCopy.reviewLabel}
            </button>
            <p className="coach-workspace-count">
              {artifactDone ? "问题定义已深化" : "问题种子已形成"}
            </p>
            <span className="coach-topbar-spacer" aria-hidden="true" />
          </div>
          <div className="coach-grown-body">
            <aside
              className="coach-artifact-rail"
              aria-label="Artifacts 入口(问题定义已开放深化,其余为下一阶段能力预告)"
            >
              <p className="coach-artifact-title">Artifacts</p>
              <ul className="coach-artifact-list">
                {ARTIFACT_SLOTS.map((slot, index) =>
                  index === 0 ? (
                    <li key={slot.label} data-coach-artifact data-artifact-slot-active>
                      {state.phase === "seed" ? (
                        <button
                          type="button"
                          className="coach-artifact-entry"
                          data-artifact-entry
                          aria-label={`${artifactCopy.startLabel}(第一份 Artifact)`}
                          onClick={() => dispatch({ type: "startArtifact" })}
                        >
                          <span className="coach-artifact-icon" aria-hidden="true">
                            {slot.icon}
                          </span>
                          <span>{artifactCopy.startLabel}</span>
                        </button>
                      ) : (
                        <span className="coach-artifact-entry coach-artifact-entry--lit" data-artifact-lit>
                          <span className="coach-artifact-icon" aria-hidden="true">
                            {slot.icon}
                          </span>
                          <span>{artifactCopy.litLabel}</span>
                        </span>
                      )}
                    </li>
                  ) : (
                    <li key={slot.label} data-coach-artifact>
                      <span className="coach-artifact-icon" aria-hidden="true">
                        {slot.icon}
                      </span>
                      <span className="sr-only">{slot.label}</span>
                    </li>
                  )
                )}
              </ul>
              <p className="coach-artifact-note">{artifactCopy.railNote}</p>
            </aside>
            <div className="coach-workspace-dialog coach-workspace-dialog--seed">
              <div
                ref={seedScrollRef}
                className="coach-conversation-scroll"
                data-coach-conversation-scroll
                tabIndex={0}
              >
                {seed ? (
                  <SeedCard
                    seed={seed}
                    meta={seedMeta}
                    headingRef={seedHeadingRef}
                    headingId={`${orbIdPrefix}-seed-title`}
                  />
                ) : (
                  <ArtifactCard
                    artifact={artifactDone!}
                    meta={artifactMeta}
                    headingRef={artifactHeadingRef}
                    headingId={`${orbIdPrefix}-artifact-title`}
                    onReturnToSeed={() => dispatch({ type: "returnToSeed" })}
                    onRestart={resetFlow}
                  />
                )}
              </div>
              {seed && (
                <div className="coach-workspace-seed-actions">
                  <button type="button" className="coach-restart" onClick={resetFlow}>
                    重新开始
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 打磨轮⑥:常驻问题卡(桌面右栏/窄屏进度条),与主场景同格渲染;
              只读上下文,不是第二决策点 */}
          <CoachMiniCard
            slots={progressSlots}
            showDeepenings={artifactStage}
            justFilledKey={justFilledKey}
            waiting={providerPending}
          />
          <CoachWorkspaceScene
            act={artifactStage ? artifactAct : act}
            nextAct={artifactStage ? artifactNextAct : nextAct}
            actIndex={artifactStage ? state.artifactRound : state.actIndex}
            actCount={artifactStage ? ARTIFACT_ROUND_COUNT : ACT_COUNT}
            counterPrefix={artifactStage ? artifactCopy.counterPrefix : undefined}
            value={answer}
            error={state.error}
            transitioning={transitioning}
            condensing={condensing}
            transitionStep={transitionStep}
            pending={providerPending}
            attachment={artifactStage ? null : attachment}
            attachmentError={artifactStage ? null : attachmentError}
            attachmentNotice={attachmentPrivacyNotice}
            /* 隐私前置披露:会外发的幕/轮常驻,客户端凝结的末幕/末轮不渲染 */
            privacyNotice={
              artifactStage
                ? state.artifactRound < ARTIFACT_ROUND_COUNT - 1
                  ? coachPrivacyNotice
                  : null
                : state.actIndex < ACT_COUNT - 1
                  ? coachPrivacyNotice
                  : null
            }
            attachmentEnabled={!artifactStage && state.actIndex < ACT_COUNT - 1}
            attachmentReading={attachmentReading}
            providerStatus={providerStatus}
            providerError={providerError}
            visual={visual}
            visualLabel={COACH_STATE_LABELS[visual]}
            orbIdPrefix={orbIdPrefix}
            flowBackHref={flowBackHref}
            reviewOpen={reviewOpen}
            onOpenReview={() => setReviewOpen(true)}
            switchEntryHref={artifactStage ? undefined : switchEntryHref}
            switchEntryLabel={artifactStage ? undefined : switchEntryLabel}
            returnAction={
              artifactStage
                ? {
                    label: `← ${artifactCopy.backToSeedLabel}`,
                    onClick: () => dispatch({ type: "returnToSeed" }),
                  }
                : undefined
            }
            onChange={(value) => {
              setAnswer(value);
              if (state.error) dispatch({ type: "clearError" });
              if (providerError) setProviderError(null);
            }}
            onResponderFocus={setListening}
            onAttachmentSelect={(file) => {
              if (!artifactStage) void handleAttachmentSelect(file);
            }}
            onAttachmentRemove={handleAttachmentRemove}
            onCancelWait={handleCancelWait}
            onSubmit={handleSubmit}
          />
        </>
      )}

      {/* 打磨轮⑥:回看抽屉(关闭时内容不挂载,焦点回触发器) */}
      <CoachReviewDrawer
        open={reviewOpen}
        rounds={reviewRounds}
        currentLabel={currentRoundLabel}
        guideHref={backHref}
        onClose={() => {
          setReviewOpen(false);
          document.querySelector<HTMLButtonElement>("[data-coach-review-trigger]")?.focus();
        }}
      />

      {/* 场景更迭播报:过渡期各拍由焦点元素自播报,这里不再复述;
          问题由回答器的 aria-labelledby 朗读,避免同一内容重复朗读;
          打磨轮⑥:提交瞬间播报"回答沉淀到了哪一格" */}
      <p aria-live="polite" className="sr-only">
        {justFilledKey && justFilledLabel && transitioning
          ? `${coachProgressCopy.depositPrefix}${justFilledLabel}${coachProgressCopy.depositSuffix}`
          : seed
            ? `三幕完成，已凝结为问题种子。${seedCopy.subtitle}`
            : artifactDone
              ? `三轮深化完成，已凝结为${artifactCopy.title}。${artifactCopy.doneSubtitle}`
              : transitioning
                ? ""
                : providerStatus ?? ""}
      </p>
    </div>
  );
}

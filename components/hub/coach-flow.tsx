"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { COACH_STATE_LABELS } from "./coach-orb";
import { CoachWorkspaceScene, type CoachTransitionStep } from "./coach-workspace-scene";
import { SeedCard } from "./seed-card";
import {
  attachmentPrivacyNotice,
  coachPrivacyNotice,
  seedCopy,
  type CoachAct,
  type CoachEntry,
} from "@/fixtures/coach-demo";
import {
  validateCoachAttachment,
  type CoachAttachment,
} from "@/lib/hub/coach-attachment";
import {
  ACT_COUNT,
  advance,
  actsFor,
  clearError,
  composeSeed,
  composeTrace,
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
  signal,
}: {
  entry: CoachEntry;
  completedAct: 0 | 1;
  answers: readonly string[];
  /** 随当前回答一次性发送的不可信文本附件;不持久化、不写日志 */
  attachment?: CoachAttachment | null;
  signal: AbortSignal;
}): Promise<CoachApiResponse> {
  const response = await fetch("/api/hub/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entry, completedAct, answers, ...(attachment ? { attachment } : {}) }),
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
  const [providerPending, setProviderPending] = useState(false);
  const [providerMode, setProviderMode] = useState<CoachApiMode | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [transitionStep, setTransitionStep] = useState<CoachTransitionStep | null>(null);
  const [attachment, setAttachment] = useState<CoachAttachment | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentReading, setAttachmentReading] = useState(false);
  const seedHeadingRef = useRef<HTMLHeadingElement>(null);
  const seedScrollRef = useRef<HTMLDivElement>(null);
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

  const transitioning = state.phase === "transition";
  const condensing = transitioning && state.actIndex === ACT_COUNT - 1;

  /* Ignore late HTTP work after unmount or a fresh attempt. */
  useEffect(() => {
    return () => {
      requestVersionRef.current += 1;
    };
  }, []);

  /**
   * 幕间时序:收拢(collect)→ 当前判断 → 最大风险 → 下一问。
   * 判断/风险只在下一幕内容确定后(live 成功或静默回退 fixture)逐拍端上,
   * 不与下一问长期并列;第三幕后不再请求模型,直接凝结为种子。
   */
  useEffect(() => {
    if (state.phase !== "transition") {
      setTransitionStep(null);
      return;
    }

    let active = true;
    const requestVersion = ++requestVersionRef.current;
    const controller = new AbortController();
    waitAbortRef.current = controller;
    const requestTimeout = window.setTimeout(() => controller.abort(), CLIENT_REQUEST_TIMEOUT_MS);
    const minimumTransition = delay(transitionMs());
    const condensingToSeed = state.actIndex >= ACT_COUNT - 1;

    const continueFlow = async () => {
      let response: CoachApiResponse | null = null;
      let requestFailed = false;

      setTransitionStep("collect");
      if (!condensingToSeed) {
        setProviderPending(true);
        setProviderError(null);
        try {
          response = await requestNextAct({
            entry: state.entry,
            completedAct: state.actIndex as 0 | 1,
            answers: state.answers,
            attachment: attachmentRef.current,
            signal: controller.signal,
          });
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
          setRemoteActs((acts) => ({ ...acts, [state.actIndex + 1]: response.act! }));
        }
        setProviderMode(response.mode);
      } else if (!condensingToSeed) {
        setProviderMode("fixture");
        if (requestFailed && !controller.signal.aborted) setProviderError(CLIENT_FALLBACK_NOTICE);
      }

      setProviderPending(false);

      /* 判断 → 风险:同一幕内容的两拍,每拍单独出现、单独退出;
         停留时长按该拍真实文案的阅读时间自适应(live 长文案不再即焚) */
      if (!condensingToSeed) {
        const dwellAct = response?.act ?? actsFor(state.entry)[state.actIndex + 1];
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
  }, [state.actIndex, state.answers, state.entry, state.phase]);

  /** 种子出现后焦点落在具名标题;以标题自身 scrollIntoView 保持可见,
      不再先聚焦标题再把容器滚到底(获焦元素不得被滚出可视区域) */
  useEffect(() => {
    if (state.phase !== "seed") return;
    const heading = seedHeadingRef.current;
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    heading.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  }, [state.phase]);

  const visual = useMemo(() => {
    if (state.phase === "question" && listening) return "listening" as const;
    return visualStateFor(state);
  }, [state, listening]);

  const fallbackAct = currentAct(state);
  const act = remoteActs[state.actIndex] ?? fallbackAct;
  const resolvedActs = actsFor(state.entry).map((fixture, index) => remoteActs[index] ?? fixture);
  const providerStatus = transitioning
    ? null
    : providerMode === "live"
      ? "这一幕由 AI 服务根据已完成回答生成。"
      : providerMode === "fixture"
        ? "这一幕沿用确定性追问。"
        : null;

  function handleSubmit() {
    if (submitLockRef.current || transitioning || state.phase === "seed" || attachmentReading) return;
    if (!isSubmittableAnswer(answer)) {
      dispatch({ type: "submit", answer });
      return;
    }
    submitLockRef.current = true;
    /* 快照当前附件:随本次回答在 transition effect 中一次性发送;
       同时作废读取令牌,提交后不允许任何在途读取回写 */
    attachmentRef.current = attachment;
    attachmentReadTokenRef.current += 1;
    dispatch({ type: "submit", answer });
    setAnswer("");
    setListening(false);
  }

  /** 读取并校验文本附件;失败只留行内错误,不出现 Chip。
      读取期间持有令牌:新选择/移除/提交/换幕/重置后,迟到的读取结果直接丢弃 */
  async function handleAttachmentSelect(file: File) {
    /* 第三幕只在客户端凝结种子,不开放附件入口(防御性兜底,UI 已不渲染) */
    if (state.actIndex >= ACT_COUNT - 1) return;
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
    setProviderPending(false);
    setProviderMode(null);
    setProviderError(null);
    setTransitionStep(null);
    setAttachment(null);
    setAttachmentError(null);
    setAttachmentReading(false);
    attachmentRef.current = null;
  }

  const seed = state.phase === "seed" ? composeSeed(state) : null;
    const backHref = "/guide";
    const switchEntryHref = state.entry === "problem" ? `${entryBasePath}?entry=idea` : entryBasePath;
    const switchEntryLabel = state.entry === "problem" ? "换一条入口:从已有想法开始" : "换一条入口:从真实问题开始";
    const traces = state.answers.map((text, index) => composeTrace(index, text));
    const nextAct = state.actIndex < ACT_COUNT - 1 ? resolvedActs[state.actIndex + 1] : null;

    return (
      <div
        className={`coach-workspace-grid coach-stage${seed ? " coach-workspace-grid--grown" : ""}`}
        aria-busy={transitioning || providerPending}
      >
        {seed ? (
          /* 状态 D:问题种子凝结后,工作空间才长出来 */
          <div className="coach-grown">
            <div className="coach-topbar">
              <Link href={backHref} className="coach-topbar-back hub-quiet-link">
                ← 返回活动指南
              </Link>
              <p className="coach-workspace-count">问题种子已形成</p>
              <span className="coach-topbar-spacer" aria-hidden="true" />
            </div>
            <div className="coach-grown-body">
              <aside
                className="coach-artifact-rail"
                aria-label="Artifacts 入口(下一阶段能力预告,当前默认仅图标)"
              >
                <p className="coach-artifact-title">Artifacts</p>
                <ul className="coach-artifact-list">
                  {ARTIFACT_SLOTS.map((slot) => (
                    <li key={slot.label} data-coach-artifact>
                      <span className="coach-artifact-icon" aria-hidden="true">
                        {slot.icon}
                      </span>
                      <span className="sr-only">{slot.label}</span>
                    </li>
                  ))}
                </ul>
                <p className="coach-artifact-note">在完整流程中逐份沉淀</p>
              </aside>
              <div className="coach-workspace-dialog coach-workspace-dialog--seed">
                <div
                  ref={seedScrollRef}
                  className="coach-conversation-scroll"
                  data-coach-conversation-scroll
                  tabIndex={0}
                >
                  <SeedCard seed={seed} headingRef={seedHeadingRef} headingId={`${orbIdPrefix}-seed-title`} />
                </div>
                <div className="coach-workspace-seed-actions">
                  <button type="button" className="coach-restart" onClick={resetFlow}>
                    重新开始
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <CoachWorkspaceScene
            act={act}
            nextAct={nextAct}
            traces={traces}
            actIndex={state.actIndex}
            actCount={ACT_COUNT}
            value={answer}
            error={state.error}
            transitioning={transitioning}
            condensing={condensing}
            transitionStep={transitionStep}
            pending={providerPending}
            attachment={attachment}
            attachmentError={attachmentError}
            attachmentNotice={attachmentPrivacyNotice}
            privacyNotice={coachPrivacyNotice}
            attachmentEnabled={state.actIndex < ACT_COUNT - 1}
            attachmentReading={attachmentReading}
            providerStatus={providerStatus}
            providerError={providerError}
            visual={visual}
            visualLabel={COACH_STATE_LABELS[visual]}
            orbIdPrefix={orbIdPrefix}
            backHref={backHref}
            switchEntryHref={switchEntryHref}
            switchEntryLabel={switchEntryLabel}
            onChange={(value) => {
              setAnswer(value);
              if (state.error) dispatch({ type: "clearError" });
              if (providerError) setProviderError(null);
            }}
            onResponderFocus={setListening}
            onAttachmentSelect={(file) => void handleAttachmentSelect(file)}
            onAttachmentRemove={handleAttachmentRemove}
            onCancelWait={handleCancelWait}
            onSubmit={handleSubmit}
          />
        )}

        {/* 场景更迭播报:过渡期各拍由焦点元素自播报,这里不再复述;
            问题由回答器的 aria-labelledby 朗读,避免同一内容重复朗读 */}
        <p aria-live="polite" className="sr-only">
          {seed
            ? `三幕完成，已凝结为问题种子。${seedCopy.subtitle}`
            : transitioning
              ? ""
              : providerStatus ?? ""}
        </p>
      </div>
    );
}

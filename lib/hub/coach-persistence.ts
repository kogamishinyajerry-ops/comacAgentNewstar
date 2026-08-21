/**
 * §35:Coach 会话持久化(sessionStorage,session-only——§28 会话级定位不变)。
 *
 * 纯函数模块:不碰 window / Storage / 网络,序列化与恢复校验全部可单测;
 * 实际的 getItem/setItem/removeItem 由组件层(coach-flow.tsx)负责。
 *
 * 键设计:`coach-flow:v1:{entry}`——版本进键(结构演进即换键,旧键自然失效),
 * problem/idea 各自独立,/ 与 /start 共享同一键(两路由间往返不丢进度)。
 *
 * transient 相位:transition / artifact-transition 是"已提交、下一幕未定"的
 * 在途相位,直接恢复会重演一次过渡请求。恢复时用机器纯函数 advance() 落定到
 * 下一个稳定相位——回答已在提交瞬间入史,live 追问丢失时机器本就有确定性
 * fixture 兜底,语义一致。
 */

import type { CoachAct, CoachEntry } from "@/fixtures/coach-demo";
import {
  ACT_COUNT,
  ARTIFACT_ROUND_COUNT,
  advance,
  type CoachState,
} from "./coach-machine";

export const COACH_FLOW_STORAGE_VERSION = 1;

export function coachFlowStorageKey(entry: CoachEntry): string {
  return `coach-flow:v${COACH_FLOW_STORAGE_VERSION}:${entry}`;
}

/** 一次会话的可持久化切片;providerPending/transitionStep/attachment 等在途瞬态不在其中 */
export interface CoachFlowSnapshot {
  version: number;
  entry: CoachEntry;
  state: CoachState;
  /** live 覆盖幕次(键为幕下标;fixture 兜底不在这里) */
  remoteActs: Record<number, CoachAct>;
  artifactRemoteActs: Record<number, CoachAct>;
  /** 未提交的回答草稿 */
  answer: string;
  cardId: string;
  /** 首次凝结时刻(ISO 串);未凝结为 null */
  seedAt: string | null;
  artifactAt: string | null;
  /** 焦点接续信号(≥1 即"经历过建立拍",恢复后回答器焦点语义不变) */
  beginCount: number;
}

/** 与 coach-flow 请求校验同源的 CoachAct 形状守卫(五字段非空、≤600 字) */
export function isCoachAct(value: unknown): value is CoachAct {
  if (typeof value !== "object" || value === null) return false;
  const act = value as Record<string, unknown>;
  return ["judgment", "risk", "question", "placeholder", "emptyHint"].every(
    (key) =>
      typeof act[key] === "string" &&
      (act[key] as string).trim().length > 0 &&
      (act[key] as string).length <= 600,
  );
}

const COACH_PHASES = [
  "intro",
  "question",
  "transition",
  "seed",
  "artifact-question",
  "artifact-transition",
  "artifact-done",
] as const;

function isNonEmptyTrimmedStringArray(value: unknown, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every((item) => typeof item === "string" && item.trim().length > 0)
  );
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isIsoTimestampOrNull(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && !Number.isNaN(Date.parse(value)))
  );
}

/** 相位—进度不变量(与状态机同构):任一不满足即视为快照损坏,整体回退初始态 */
function matchesPhaseInvariants(state: {
  phase: string;
  actIndex: number;
  answers: string[];
  artifactRound: number;
  artifactAnswers: string[];
}): boolean {
  const answered = state.answers.length;
  const deepened = state.artifactAnswers.length;
  switch (state.phase) {
    case "intro":
      return state.actIndex === 0 && answered === 0 && deepened === 0;
    case "question":
      return answered === state.actIndex;
    case "transition":
      return answered === state.actIndex + 1;
    case "seed":
      /* 深化中途回到种子:artifactAnswers 可以是 0..满轮 任意值 */
      return answered === ACT_COUNT;
    case "artifact-question":
      return answered === ACT_COUNT && deepened === state.artifactRound;
    case "artifact-transition":
      return answered === ACT_COUNT && deepened === state.artifactRound + 1;
    case "artifact-done":
      return answered === ACT_COUNT && deepened === ARTIFACT_ROUND_COUNT;
    default:
      return false;
  }
}

function isValidCoachState(value: unknown, entry: CoachEntry): value is CoachState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  if (state.entry !== entry) return false;
  if (typeof state.phase !== "string" || !COACH_PHASES.includes(state.phase as never)) {
    return false;
  }
  if (!isIntegerInRange(state.actIndex, 0, ACT_COUNT - 1)) return false;
  if (!isNonEmptyTrimmedStringArray(state.answers, ACT_COUNT)) return false;
  if (state.error !== null && typeof state.error !== "string") return false;
  if (!isIntegerInRange(state.artifactRound, 0, ARTIFACT_ROUND_COUNT - 1)) return false;
  if (!isNonEmptyTrimmedStringArray(state.artifactAnswers, ARTIFACT_ROUND_COUNT)) return false;
  return matchesPhaseInvariants({
    phase: state.phase,
    actIndex: state.actIndex,
    answers: state.answers,
    artifactRound: state.artifactRound,
    artifactAnswers: state.artifactAnswers,
  });
}

/** live 幕次表:键必须是合法幕下标(JSON 对象键为字符串,恢复时转回 number) */
function parseActMap(value: unknown, maxKey: number): Record<number, CoachAct> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const result: Record<number, CoachAct> = {};
  for (const [key, act] of Object.entries(value)) {
    const index = Number(key);
    if (!isIntegerInRange(index, 0, maxKey)) return null;
    if (!isCoachAct(act)) return null;
    result[index] = act;
  }
  return result;
}

export function serializeCoachFlow(snapshot: CoachFlowSnapshot): string {
  return JSON.stringify(snapshot);
}

/** transient 相位用 advance() 落定到下一个稳定相位(advance 一次即稳定) */
export function settleTransientPhase(state: CoachState): CoachState {
  let settled = state;
  while (settled.phase === "transition" || settled.phase === "artifact-transition") {
    settled = advance(settled);
  }
  return settled;
}

/**
 * 读取并校验快照。版本不符、entry 不符、形状损坏(含相位—进度不变量破坏)
 * 一律返回 null——调用方安全回退到初始态,不做局部修复。
 */
export function restoreCoachFlowSnapshot(
  raw: string | null,
  entry: CoachEntry,
): CoachFlowSnapshot | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const snapshot = parsed as Record<string, unknown>;
  if (snapshot.version !== COACH_FLOW_STORAGE_VERSION) return null;
  if (snapshot.entry !== entry) return null;
  if (!isValidCoachState(snapshot.state, entry)) return null;
  const remoteActs = parseActMap(snapshot.remoteActs, ACT_COUNT - 1);
  const artifactRemoteActs = parseActMap(snapshot.artifactRemoteActs, ARTIFACT_ROUND_COUNT - 1);
  if (remoteActs === null || artifactRemoteActs === null) return null;
  if (typeof snapshot.answer !== "string") return null;
  if (typeof snapshot.cardId !== "string" || snapshot.cardId.length === 0) return null;
  if (!isIsoTimestampOrNull(snapshot.seedAt) || !isIsoTimestampOrNull(snapshot.artifactAt)) {
    return null;
  }
  if (!Number.isInteger(snapshot.beginCount) || (snapshot.beginCount as number) < 0) return null;
  const beginCount = snapshot.beginCount as number;

  return {
    version: COACH_FLOW_STORAGE_VERSION,
    entry,
    state: settleTransientPhase(snapshot.state),
    remoteActs,
    artifactRemoteActs,
    answer: snapshot.answer,
    cardId: snapshot.cardId,
    seedAt: snapshot.seedAt,
    artifactAt: snapshot.artifactAt,
    beginCount,
  };
}

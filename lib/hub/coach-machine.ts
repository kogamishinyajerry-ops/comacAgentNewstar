/**
 * Coach 三幕确定性状态机(纯函数,无 DOM / 网络 / 数据库依赖)。
 *
 * 阶段一:同一时刻只有一幕;提交一问的答案推进到下一幕;
 * 第三幕提交后进入"凝结",输出问题种子。视觉状态由组件层
 * 依据 phase 与焦点派生(idle/listening/challenging/condensing/confirmed)。
 */

import {
  coachDemoActs,
  seedCopy,
  type CoachEntry,
} from "@/fixtures/coach-demo";

export type CoachPhase = "question" | "transition" | "seed";
export type CoachVisualState =
  | "idle"
  | "listening"
  | "challenging"
  | "condensing"
  | "confirmed";

export interface CoachState {
  entry: CoachEntry;
  /** 当前幕下标(0-2) */
  actIndex: number;
  phase: CoachPhase;
  /** 三幕答案(按幕序) */
  answers: string[];
  /** 空白提交时的行内错误文案;回答后清除 */
  error: string | null;
}

export const ACT_COUNT = coachDemoActs.problem.length;

export function createCoachState(entry: CoachEntry): CoachState {
  return { entry, actIndex: 0, phase: "question", answers: [], error: null };
}

/** 空白输入的最小判定:去掉空白后至少要有内容 */
export function isSubmittableAnswer(raw: string): boolean {
  return raw.trim().length > 0;
}

/**
 * 提交当前幕答案。
 * - 无效输入:返回带 error 的新状态(停留在当前幕);
 * - 有效输入:记录答案;若还有下一幕 → transition(组件层定时切到下一幕 question);
 *   若是最后一幕 → transition(向光核收拢),组件层凝结为 seed。
 */
export function submitAnswer(state: CoachState, raw: string): CoachState {
  if (state.phase === "seed") return state;
  if (!isSubmittableAnswer(raw)) {
    return { ...state, error: actsFor(state.entry)[state.actIndex].emptyHint };
  }
  const answers = state.answers.concat(raw.trim());
  return {
    ...state,
    answers,
    error: null,
    phase: "transition",
  };
}

/** transition 期满后调用:进入下一幕,或凝结出种子 */
export function advance(state: CoachState): CoachState {
  if (state.phase !== "transition") return state;
  if (state.actIndex < ACT_COUNT - 1) {
    return { ...state, actIndex: state.actIndex + 1, phase: "question" };
  }
  return { ...state, phase: "seed" };
}

/** 清除行内错误(输入时) */
export function clearError(state: CoachState): CoachState {
  return state.error === null ? state : { ...state, error: null };
}

export function actsFor(entry: CoachEntry) {
  return coachDemoActs[entry];
}

export function currentAct(state: CoachState) {
  return actsFor(state.entry)[state.actIndex];
}

/** 依据 phase 派生视觉状态;listening 由组件层叠加(聚焦/输入中) */
export function visualStateFor(state: CoachState): CoachVisualState {
  switch (state.phase) {
    case "question":
      return "idle";
    case "transition":
      return state.actIndex < ACT_COUNT - 1 ? "challenging" : "condensing";
    case "seed":
      return "confirmed";
  }
}

/** 问题种子:由三幕回答确定性合成的草稿(不伪造分析,只做摘录与固定缺口标注) */
export interface QuestionSeed {
  moment: string;
  impact: string;
  necessity: string;
  gaps: readonly string[];
}

const EXCERPT_MAX = 72;

/** 摘录:保留首句语义,超长时截断并加省略号 */
export function excerpt(raw: string, max = EXCERPT_MAX): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 2)) + "……";
}

export function composeSeed(state: CoachState): QuestionSeed {
  const [moment = "", impact = "", necessity = ""] = state.answers;
  return {
    moment: excerpt(moment),
    impact: excerpt(impact),
    necessity: excerpt(necessity),
    gaps: seedCopy.gaps,
  };
}

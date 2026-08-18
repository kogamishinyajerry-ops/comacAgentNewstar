/**
 * Coach 三幕确定性状态机(纯函数,无 DOM / 网络 / 数据库依赖)。
 *
 * 阶段一:同一时刻只有一幕;提交一问的答案推进到下一幕;
 * 第三幕提交后进入"凝结",输出问题种子。视觉状态由组件层
 * 依据 phase 与焦点派生(idle/listening/challenging/condensing/confirmed)。
 *
 * 第四幕(§22 阶段1):种子之后可选进入"问题定义 Artifact"三轮深化,
 * 与三幕同构(一问一答、末轮不发请求、客户端确定性凝结),
 * 但与 ACT_COUNT 语义正交,不影响既有幕计数与断言。
 */

import {
  artifactCopy,
  coachDemoActs,
  coachDemoArtifactActs,
  seedCopy,
  type CoachAct,
  type CoachEntry,
} from "@/fixtures/coach-demo";

export type CoachPhase =
  | "question"
  | "transition"
  | "seed"
  | "artifact-question"
  | "artifact-transition"
  | "artifact-done";
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
  /** 第四幕:当前深化轮(0 起);artifactAnswers 已完成的深化回答(按轮序) */
  artifactRound: number;
  artifactAnswers: string[];
}

export const ACT_COUNT = coachDemoActs.problem.length;
export const ARTIFACT_ROUND_COUNT = coachDemoArtifactActs.length;

export function createCoachState(entry: CoachEntry): CoachState {
  return {
    entry,
    actIndex: 0,
    phase: "question",
    answers: [],
    error: null,
    artifactRound: 0,
    artifactAnswers: [],
  };
}

/** 空白输入的最小判定:去掉空白后至少要有内容 */
export function isSubmittableAnswer(raw: string): boolean {
  return raw.trim().length > 0;
}

/**
 * 提交当前幕(或当前深化轮)答案。
 * - 无效输入:返回带 error 的新状态(停留在当前幕/轮);
 * - 有效输入:记录答案并进入 transition;末幕/末轮同样走 transition,
 *   由 advance 决定是下一幕、种子、下一轮还是问题定义卡。
 */
export function submitAnswer(state: CoachState, raw: string): CoachState {
  if (state.phase === "seed" || state.phase === "artifact-done") return state;
  if (!isSubmittableAnswer(raw)) {
    return { ...state, error: currentAct(state).emptyHint };
  }
  if (state.phase === "artifact-question") {
    return {
      ...state,
      artifactAnswers: state.artifactAnswers.concat(raw.trim()),
      error: null,
      phase: "artifact-transition",
    };
  }
  if (state.phase !== "question") return state;
  const answers = state.answers.concat(raw.trim());
  return {
    ...state,
    answers,
    error: null,
    phase: "transition",
  };
}

/** transition 期满后调用:进入下一幕/下一轮,或凝结出种子/问题定义 */
export function advance(state: CoachState): CoachState {
  if (state.phase === "transition") {
    if (state.actIndex < ACT_COUNT - 1) {
      return { ...state, actIndex: state.actIndex + 1, phase: "question" };
    }
    return { ...state, phase: "seed" };
  }
  if (state.phase === "artifact-transition") {
    if (state.artifactRound < ARTIFACT_ROUND_COUNT - 1) {
      return { ...state, artifactRound: state.artifactRound + 1, phase: "artifact-question" };
    }
    return { ...state, phase: "artifact-done" };
  }
  return state;
}

/** 清除行内错误(输入时) */
export function clearError(state: CoachState): CoachState {
  return state.error === null ? state : { ...state, error: null };
}

/**
 * 从种子进入第四幕。已完成的深化进度被保留:
 * 再次进入时从首个未完成轮继续,全部完成则直接回到问题定义卡。
 */
export function startArtifact(state: CoachState): CoachState {
  if (state.phase !== "seed") return state;
  if (state.artifactAnswers.length >= ARTIFACT_ROUND_COUNT) {
    return { ...state, phase: "artifact-done" };
  }
  return {
    ...state,
    artifactRound: state.artifactAnswers.length,
    phase: "artifact-question",
    error: null,
  };
}

/** 安静返回种子视图;深化进度保留,可通过第一格再次进入 */
export function returnToSeed(state: CoachState): CoachState {
  if (state.phase !== "artifact-question" && state.phase !== "artifact-done") return state;
  return { ...state, phase: "seed", error: null };
}

export function actsFor(entry: CoachEntry) {
  return coachDemoActs[entry];
}

/** 第四幕固定文案的确定性访问(与入口无关) */
export function artifactActsFor(): readonly CoachAct[] {
  return coachDemoArtifactActs;
}

export function currentAct(state: CoachState): CoachAct {
  if (state.phase.startsWith("artifact")) {
    return coachDemoArtifactActs[Math.min(state.artifactRound, ARTIFACT_ROUND_COUNT - 1)];
  }
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
    case "artifact-question":
      return "challenging";
    case "artifact-transition":
      return "condensing";
    case "artifact-done":
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

/** 已完成幕在一行结论轨迹中的标签(历史退为轨迹,不再保留完整问答气泡) */
export const TRACE_LABELS = ["问题", "影响", "Agent 必要性"] as const;

/** 一行结论轨迹:幕标签 + 短摘录;完整原回答默认不再展示 */
export function composeTrace(actIndex: number, answer: string): string {
  const label = TRACE_LABELS[actIndex] ?? `第 ${actIndex + 1} 幕`;
  return `${label}:${excerpt(answer, 20)}`;
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

/**
 * 种子导出为纯文本(复制到剪贴板用)。只重组既有槽位与固定文案,
 * 不新增判断、不引入未出现的结论;无持久化,复制仅发生在浏览器本地。
 */
export function composeSeedText(seed: QuestionSeed): string {
  return [
    seedCopy.title,
    seedCopy.subtitle,
    "",
    `【${seedCopy.structure.claim}】`,
    `${seedCopy.slots.moment}:${seed.moment}`,
    `${seedCopy.slots.necessity}:${seed.necessity}`,
    "",
    `【${seedCopy.structure.evidence}】`,
    `${seedCopy.slots.impact}:${seed.impact}`,
    seedCopy.evidenceNote,
    "",
    `【${seedCopy.structure.gaps}】${seedCopy.gapsTitle}`,
    ...seed.gaps.map((gap) => `◇ ${gap}`),
  ].join("\n");
}

/** 深化轮在一行结论轨迹中的标签(与三幕轨迹同形) */
export function composeArtifactTrace(round: number, answer: string): string {
  const label = artifactCopy.dimensionLabels[round] ?? `第 ${round + 1} 轮`;
  return `${artifactCopy.counterPrefix}·${label}:${excerpt(answer, 20)}`;
}

/** 问题定义:种子三槽 + 三轮深化记录;缺口原样保留(深化不等于解决) */
export interface ArtifactDeepening {
  label: string;
  question: string;
  answer: string;
}

export interface QuestionDefinition {
  moment: string;
  impact: string;
  necessity: string;
  deepenings: readonly ArtifactDeepening[];
  gaps: readonly string[];
}

export function composeArtifact(state: CoachState): QuestionDefinition {
  const [moment = "", impact = "", necessity = ""] = state.answers;
  return {
    moment: excerpt(moment),
    impact: excerpt(impact),
    necessity: excerpt(necessity),
    deepenings: state.artifactAnswers.map((answer, index) => ({
      label: artifactCopy.dimensionLabels[index],
      question: excerpt(coachDemoArtifactActs[index]?.question ?? "", 48),
      answer: excerpt(answer),
    })),
    gaps: seedCopy.gaps,
  };
}

/**
 * 问题定义导出为纯文本(复制到剪贴板用)。只重组种子文本、
 * 深化轮的固定问题与回答摘录,不新增任何判断或结论。
 */
export function composeArtifactText(artifact: QuestionDefinition): string {
  return [
    artifactCopy.title,
    artifactCopy.doneSubtitle,
    "",
    `【${seedCopy.structure.claim}】`,
    `${seedCopy.slots.moment}:${artifact.moment}`,
    `${seedCopy.slots.necessity}:${artifact.necessity}`,
    "",
    `【${seedCopy.structure.evidence}】`,
    `${seedCopy.slots.impact}:${artifact.impact}`,
    "",
    `【${artifactCopy.deepeningLabel}】`,
    ...artifact.deepenings.flatMap((item) => [
      `·${item.label}`,
      `  问:${item.question}`,
      `  答:${item.answer}`,
    ]),
    artifactCopy.deepeningNote,
    "",
    `【${seedCopy.structure.gaps}】${seedCopy.gapsTitle}`,
    ...artifact.gaps.map((gap) => `◇ ${gap}`),
  ].join("\n");
}

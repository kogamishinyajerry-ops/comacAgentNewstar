export const GAME_GRADE_TRACE_STEPS = [
  { key: "moment", label: "真实瞬间" },
  { key: "impact", label: "具体影响" },
  { key: "necessity", label: "Agent 必要性" },
] as const;

export type GameGradeTraceNodeState = "filled" | "current" | "upcoming";
export type GameGradeTraceStatus = "forming" | "reordering" | "confirmed";

export interface GameGradeTraceNode {
  key: (typeof GAME_GRADE_TRACE_STEPS)[number]["key"];
  label: string;
  state: GameGradeTraceNodeState;
}

export interface GameGradeTraceSnapshot {
  completedCount: number;
  status: GameGradeTraceStatus;
  statusLabel: string;
  nodes: readonly GameGradeTraceNode[];
}

function clampCompletedCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(GAME_GRADE_TRACE_STEPS.length, Math.max(0, Math.trunc(value)));
}

/**
 * 将已有 Coach 三幕状态映射为 game-grade 的“问题世界”轨迹。
 * 该轨迹只表达用户已经沉淀了哪些判断，以及当前是否正在收拢线索；
 * 它不是完成率、评分或阶段门禁。
 */
export function deriveGameGradeTrace({
  completedCount,
  transitioning,
  confirmed,
}: {
  completedCount: number;
  transitioning: boolean;
  confirmed: boolean;
}): GameGradeTraceSnapshot {
  const completed = confirmed
    ? GAME_GRADE_TRACE_STEPS.length
    : clampCompletedCount(completedCount);

  const status: GameGradeTraceStatus = confirmed
    ? "confirmed"
    : transitioning
      ? "reordering"
      : "forming";

  const statusLabel = confirmed
    ? "问题种子已凝结"
    : transitioning
      ? "Coach 正在重排线索"
      : completed === 0
        ? "问题种子尚未形成，从一个真实瞬间开始"
        : `问题种子正在形成，已沉淀 ${completed} 个判断`;

  const nodes = GAME_GRADE_TRACE_STEPS.map<GameGradeTraceNode>((step, index) => {
    let state: GameGradeTraceNodeState = "upcoming";
    if (index < completed || confirmed) {
      state = "filled";
    } else if (index === completed) {
      state = "current";
    }
    return { ...step, state };
  });

  return {
    completedCount: completed,
    status,
    statusLabel,
    nodes,
  };
}

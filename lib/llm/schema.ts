// Agent 结构化输出的 Zod Schema(与活动规则第五节一致)

import { z } from "zod";
import { PRECHECK_NOTE } from "../constants";

export const riskTypes = [
  "scope_too_large",
  "sensitive_data",
  "existing_project",
  "team_size",
  "no_verification",
  "engineering_judgement",
  "production_integration",
  "other",
] as const;

export const RiskFlagSchema = z.object({
  type: z.enum(riskTypes),
  severity: z.enum(["low", "medium", "high"]),
  message: z.string().min(1),
});

export const PrecheckScoresSchema = z.object({
  problem_definition: z.number().min(0).max(10),
  originality: z.number().min(0).max(10),
  closed_loop: z.number().min(0).max(10),
  evidence: z.number().min(0).max(10),
  total: z.number().min(0).max(40),
  note: z.string().default(PRECHECK_NOTE),
});

export const AgentFeedbackSchema = z
  .object({
    stage_assessment: z.enum(["ready", "needs_revision", "blocked"]),
    summary: z.string().min(1),
    critical_gaps: z.array(z.object({ field: z.string(), reason: z.string() })).max(10).default([]),
    questions: z.array(z.string()).max(6).default([]),
    suggestions: z
      .array(z.object({ title: z.string(), action: z.string(), why: z.string() }))
      .max(6)
      .default([]),
    risk_flags: z.array(RiskFlagSchema).max(10).default([]),
    next_action: z.string().min(1),
    can_continue: z.boolean(),
    precheck_scores: PrecheckScoresSchema.nullable().default(null),
    // 降级时携带的可读原文(非隐藏思维链)
    raw_feedback: z.string().optional(),
  })
  .passthrough();

export type AgentFeedback = z.infer<typeof AgentFeedbackSchema>;

const clamp = (n: number, lo = 0, hi = 10) => Math.max(lo, Math.min(hi, Math.round(n)));

/**
 * 规范化模型输出,强制满足活动规则约束:
 * 建议≤3条、问题≤3个、预检备注文案固定、分数限制在区间内且 total 一致。
 */
export function normalizeFeedback(input: AgentFeedback): AgentFeedback {
  const fb: AgentFeedback = {
    ...input,
    questions: input.questions.slice(0, 3),
    suggestions: input.suggestions.slice(0, 3),
    critical_gaps: input.critical_gaps.slice(0, 6),
    risk_flags: input.risk_flags.slice(0, 8),
  };
  if (fb.precheck_scores) {
    const p = fb.precheck_scores;
    const scores = {
      problem_definition: clamp(p.problem_definition),
      originality: clamp(p.originality),
      closed_loop: clamp(p.closed_loop),
      evidence: clamp(p.evidence),
    };
    fb.precheck_scores = {
      ...scores,
      total: clamp(scores.problem_definition + scores.originality + scores.closed_loop + scores.evidence, 0, 40),
      note: PRECHECK_NOTE,
    };
  }
  return fb;
}

/** 解析失败后的降级反馈:可读、合规、不含思维链 */
export function fallbackFeedback(rawText: string): AgentFeedback {
  return normalizeFeedback({
    stage_assessment: "needs_revision",
    summary: "AI 本次未能返回结构化结果,已降级为可读反馈,请稍后重试或参考下方原文。",
    critical_gaps: [],
    questions: [],
    suggestions: [],
    risk_flags: [],
    next_action: "请点击\"重新诊断\"再试一次;若持续失败可继续手动完善当前步骤。",
    can_continue: true,
    precheck_scores: null,
    raw_feedback: (rawText || "").slice(0, 2000),
  });
}

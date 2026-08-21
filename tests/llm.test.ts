import { describe, expect, it } from "vitest";
import { AgentFeedbackSchema, fallbackFeedback, normalizeFeedback } from "../lib/llm/schema";
import { coerceFeedbackShape, tryParseJson } from "../lib/llm/repair";
import { generateMockFeedback } from "../lib/llm/mock";
import { buildUserContext } from "../lib/llm/coach";
import {
  applyDecisionIntent,
  buildDecisionArtifact,
  withDecisionArtifacts,
} from "../lib/agent-collaboration/decision";
import type { ProjectBundle } from "../lib/projects";

const bundle = (over: Partial<ProjectBundle> = {}): ProjectBundle => ({
  project: { id: "p1", title: "测试项目", track: "process-automation", status: "DRAFT", currentStep: 4, teamId: "t1", createdAt: new Date(), submittedAt: null },
  team: {
    id: "t1", name: "队", mode: "SOLO", inviteCode: "AAAA1111",
    startTime: "2026-08-20", existingBase: "无", addedDuringActivity: "全部", externalResources: "GLM", helpers: "无", memberCount: 1,
  },
  members: [{ userId: "u1", name: "甲", email: "a@b.c", seatRole: "OWNER" }],
  stages: [
    { step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) },
    {
      step: 4,
      data: JSON.stringify({
        targetUser: "新员工", scenario: "拼对比说明", frequency: "每周2次", currentProcess: "手工",
        worstStep: "对错行", currentCost: "2小时", whyWorth: "减少错漏",
      }),
    },
  ],
  testCases: [
    { id: "1", name: "常规", type: "NORMAL", input: "a", expected: "b", actual: "b", verdict: "PASS", manualFix: "", failureReason: "", sortOrder: 1 },
    { id: "2", name: "边界", type: "BOUNDARY", input: "a", expected: "b", actual: "", verdict: "PENDING", manualFix: "", failureReason: "", sortOrder: 2 },
  ],
  ...over,
});

describe("normalizeFeedback 规则约束", () => {
  it("建议截断到3条、问题截断到3个", () => {
    const fb = normalizeFeedback({
      stage_assessment: "needs_revision",
      summary: "s",
      critical_gaps: [],
      questions: ["q1", "q2", "q3", "q4"],
      suggestions: [
        { title: "1", action: "a", why: "w" },
        { title: "2", action: "a", why: "w" },
        { title: "3", action: "a", why: "w" },
        { title: "4", action: "a", why: "w" },
      ],
      risk_flags: [],
      next_action: "n",
      can_continue: true,
      precheck_scores: null,
    });
    expect(fb.suggestions).toHaveLength(3);
    expect(fb.questions).toHaveLength(3);
  });

  it("预检分数被钳制且note固定", () => {
    const fb = normalizeFeedback({
      stage_assessment: "ready", summary: "s", critical_gaps: [], questions: [], suggestions: [],
      risk_flags: [], next_action: "n", can_continue: true,
      precheck_scores: {
        problem_definition: 15, originality: -3, closed_loop: 8, evidence: 9, total: 999, note: "随便写的",
      },
    });
    expect(fb.precheck_scores?.problem_definition).toBe(10);
    expect(fb.precheck_scores?.originality).toBe(0);
    expect(fb.precheck_scores?.note).toBe("仅供完善材料参考,不代表正式评审结果。");
    expect(fb.precheck_scores?.total).toBeLessThanOrEqual(40);
  });

  it("fallback 反馈始终通过Schema", () => {
    const fb = fallbackFeedback("模型输出了一堆乱码 {{{");
    expect(AgentFeedbackSchema.safeParse(fb).success).toBe(true);
    expect(fb.stage_assessment).toBe("needs_revision");
  });
});

describe("tryParseJson 修复", () => {
  it("直接解析纯JSON", () => {
    expect(tryParseJson('{"a":1}', false)).toEqual({ a: 1 });
  });
  it("剥离代码围栏", () => {
    expect(tryParseJson('```json\n{"a":1}\n```', false)).toEqual({ a: 1 });
  });
  it("修复尾逗号", () => {
    expect(tryParseJson('{"a":[1,2,],}', true)).toEqual({ a: [1, 2] });
  });
  it("完全无效时返回null", () => {
    expect(tryParseJson("not json at all", true)).toBeNull();
  });
});

describe("coerceFeedbackShape 形状矫正", () => {
  it("把字符串数组形式的缺口与建议转成对象并通过Schema", () => {
    const raw = {
      precheck_scores: { problem_definition: 8, originality: 5, closed_loop: 0, evidence: 1, total: 14, note: "x" },
      critical_gaps: ["闭环设计完全缺失", "测试案例为0个"],
      suggestions: ["补全阶段5闭环设计材料", "补充至少5个测试案例"],
    };
    const parsed = AgentFeedbackSchema.safeParse(coerceFeedbackShape(raw));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const fb = normalizeFeedback(parsed.data);
      expect(fb.critical_gaps[0]).toHaveProperty("reason", "闭环设计完全缺失");
      expect(fb.suggestions[0]).toHaveProperty("action", "补全阶段5闭环设计材料");
      expect(fb.precheck_scores?.note).toContain("不代表正式评审结果");
    }
  });
  it("补齐缺失的必填字段", () => {
    const coerced = coerceFeedbackShape({ summary: "只有摘要" }) as Record<string, unknown>;
    expect(coerced.questions).toEqual([]);
    expect(coerced.stage_assessment).toBe("needs_revision");
    expect(typeof coerced.next_action).toBe("string");
  });
});

describe("Coach 上下文与证据边界", () => {
  it("所有阶段都包含当前 Artifact，并把 Decision 作为独立语义对象交给 Coach", () => {
    const proposed = buildDecisionArtifact({
      projectId: "p1",
      subjectRef: "project:p1:stage:8",
      stage: 8,
      title: "补充失败案例",
      proposal: "记录一个失败输入、失败原因和人工修正过程。",
      reasons: ["验证不能只有成功案例"],
      evidence: [{ id: "feedback:f1", kind: "feedback", label: "AI 导师诊断" }],
      uncertainties: ["尚未保存运行时上下文快照"],
      impacts: ["只写入当前阶段"],
      feedbackId: "f1",
      suggestionIndex: 0,
      createdAt: "2026-08-21T10:00:00.000Z",
    });
    const executed = applyDecisionIntent({
      artifact: proposed,
      intent: "approve",
      actor: { id: "u1", name: "甲", type: "human" },
      timestamp: "2026-08-21T10:01:00.000Z",
    });
    const current = bundle({
      stages: [
        ...bundle().stages,
        {
          step: 8,
          data: JSON.stringify(withDecisionArtifacts({ evidenceNote: "当前阶段人工记录" }, [executed])),
        },
      ],
    });

    const context = JSON.parse(buildUserContext(current, 8, "COACH")) as {
      stages_summary: Record<string, Record<string, unknown>>;
      current_decisions: Array<{
        id: string;
        proposal: string;
        state: string;
        recent_events: Array<{ action: string }>;
      }>;
      context_boundary: { immutable_input_snapshot_persisted: boolean; note: string };
    };

    expect(context.stages_summary["8"].evidenceNote).toBe("当前阶段人工记录");
    expect(context.stages_summary["8"].__decisionArtifacts).toBeUndefined();
    expect(context.current_decisions[0]).toMatchObject({
      id: executed.id,
      proposal: executed.proposal,
      state: "executed",
    });
    expect(context.current_decisions[0].recent_events.map((event) => event.action)).toContain("executed");
    expect(context.context_boundary.immutable_input_snapshot_persisted).toBe(false);
    expect(context.context_boundary.note).toContain("不可变快照或哈希");
  });
});

describe("Mock Provider 输出", () => {
  it("各步骤输出均符合Schema", () => {
    for (const step of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const fb = generateMockFeedback({ bundle: bundle(), step, purpose: "COACH" });
      const parsed = AgentFeedbackSchema.safeParse(fb);
      if (!parsed.success) throw new Error(`step ${step}: ${parsed.error.message}`);
      expect(fb.suggestions.length).toBeLessThanOrEqual(3);
      expect(fb.questions.length).toBeLessThanOrEqual(3);
      expect(fb.precheck_scores).toBeNull();
    }
  });

  it("缺少求证闭环时预检 closed_loop 为0并给出高风险", () => {
    const fb = generateMockFeedback({ bundle: bundle(), step: 9, purpose: "PRECHECK" });
    expect(fb.precheck_scores?.closed_loop).toBe(0);
    expect(fb.risk_flags.some((r) => r.type === "no_verification" && r.severity === "high")).toBe(true);
  });

  it("闭环齐备且测试充分时 closed_loop 高于0", () => {
    const full = bundle({
      stages: [
        ...bundle().stages,
        { step: 5, data: JSON.stringify({ judgmentSource: "原始记录", stopConditions: "行数不符", usableResult: "x", unacceptableErrors: "y", inputInfo: "z", outputFormat: "w", initialTestCases: "q" }) },
        { step: 6, data: JSON.stringify({ autoCheckScope: "数量日期", humanConfirmPoint: "发出前", finalOwner: "本人" }) },
      ],
    });
    const fb = generateMockFeedback({ bundle: full, step: 9, purpose: "PRECHECK" });
    expect((fb.precheck_scores?.closed_loop ?? 0) as number).toBeGreaterThan(0);
  });

  it("空材料时给出缺口与最小下一步", () => {
    const empty = bundle({
      stages: [{ step: 1, data: "{}" }],
      testCases: [],
    });
    const fb = generateMockFeedback({ bundle: empty, step: 4, purpose: "COACH" });
    expect(fb.stage_assessment).not.toBe("ready");
    expect(fb.critical_gaps.length).toBeGreaterThan(0);
    expect(fb.next_action.length).toBeGreaterThan(0);
  });
});

describe("拷问式辅导(grill)", () => {
  it("频率无数字时,追问直指估算", () => {
    const base = bundle();
    const b = bundle({
      stages: base.stages.map((s) =>
        s.step === 4
          ? {
              step: 4,
              data: JSON.stringify({
                targetUser: "新员工", scenario: "x", frequency: "经常", currentProcess: "x",
                worstStep: "x", currentCost: "x", whyWorth: "x",
              }),
            }
          : s
      ),
    });
    const fb = generateMockFeedback({ bundle: b, step: 4, purpose: "COACH" });
    const qs = fb.questions.map((q) => (typeof q === "string" ? q : q.q)).join("|");
    expect(qs).toMatch(/估的|数过/);
    for (const q of fb.questions) {
      if (typeof q !== "string") expect(q.why!.length).toBeGreaterThan(4);
    }
  });

  it("答过的问题会演进——下一轮针对回答深挖,不重复", () => {
    const b = bundle();
    const fb = generateMockFeedback({
      bundle: b,
      step: 5,
      purpose: "COACH",
      answers: [{ q: "谁说了算?", a: "以系统A导出为准" }],
    });
    const qs = fb.questions.map((q) => (typeof q === "string" ? q : q.q)).join("|");
    expect(qs).toContain("上次回答");
    expect(qs).toContain("还成立吗");
  });

  it("AI职责越界时,追问责任归属", () => {
    const b = bundle({
      stages: [
        ...bundle().stages,
        {
          step: 6,
          data: JSON.stringify({
            oneSentenceMvp: "x", coreUser: "x", coreProblem: "x", coreLoop: "x", verifiableMetric: "快一点",
            aiResponsibility: "AI负责最终判断与放行", humanResponsibility: "x", autoCheckScope: "x",
            humanConfirmPoint: "x", finalOwner: "x", tools: "x", notDoing: "x",
          }),
        },
      ],
    });
    const fb = generateMockFeedback({ bundle: b, step: 6, purpose: "COACH" });
    const qs = fb.questions.map((q) => (typeof q === "string" ? q : q.q)).join("|");
    expect(qs).toMatch(/算谁的|责任/);
    expect(qs).toMatch(/数字|达标/);
  });
});

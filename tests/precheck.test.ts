import { describe, expect, it } from "vitest";
import { runHardRules, type PrecheckInput } from "../lib/precheck";

const fullStages: Record<number, Record<string, unknown>> = {
  1: { agreeRules: true, agreeDataSafety: true, agreeOriginality: true },
  4: {
    targetUser: "新入职结构设计工程师", scenario: "评审前拼对比说明", frequency: "每周2次",
    currentProcess: "导出→复制→核对→排版", worstStep: "字段不一致对错行", currentCost: "每周2小时", whyWorth: "减少错漏",
  },
  5: {
    usableResult: "10分钟内可确认", unacceptableErrors: "条目遗漏", judgmentSource: "以原始导出为准",
    inputInfo: "两份脱敏CSV", outputFormat: "Markdown", stopConditions: "行数对不上", initialTestCases: "①②③",
  },
  6: {
    oneSentenceMvp: "自动整理对比说明", coreUser: "我", coreProblem: "手工拼说明", coreLoop: "输入→处理→检查→确认→输出",
    verifiableMetric: "40分钟降到10分钟", aiResponsibility: "对齐与草稿", humanResponsibility: "核对放行",
    autoCheckScope: "数量与日期", humanConfirmPoint: "发出前确认", finalOwner: "本人", tools: "GLM+脚本", notDoing: "不做直连",
  },
};

const fullTeam = {
  memberCount: 1,
  startTime: "2026-08-20",
  existingBase: "无",
  addedDuringActivity: "全部内容",
  externalResources: "GLM API",
  helpers: "无",
};

const fullTests = [
  { name: "常规", type: "NORMAL", input: "a", expected: "b", actual: "b", verdict: "PASS" },
  { name: "多条", type: "BOUNDARY", input: "a", expected: "b", actual: "b", verdict: "PASS" },
  { name: "空输入", type: "FAILURE", input: "(空文件)", expected: "停止", actual: "停止", verdict: "FAIL", failureReason: "未设停止条件" },
  { name: "字段缺失", type: "BOUNDARY", input: "a", expected: "b", actual: "b", verdict: "PASS" },
  { name: "敏感", type: "NA", input: "x", expected: "停止", actual: "停止", verdict: "NA", failureReason: "未脱敏" },
];

const base = (over: Partial<PrecheckInput> = {}): PrecheckInput => ({
  team: fullTeam,
  stages: Object.entries(fullStages).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) })),
  track: "process-automation",
  testCases: fullTests,
  ...over,
});

describe("runHardRules", () => {
  it("材料齐备时可以提交", () => {
    const r = runHardRules(base());
    expect(r.canSubmit).toBe(true);
    expect(r.blocking).toHaveLength(0);
  });

  it("缺少求证闭环要素时阻塞提交", () => {
    const stages = { ...fullStages, 6: { ...fullStages[6], autoCheckScope: "", humanConfirmPoint: "", finalOwner: "" } };
    const r = runHardRules(base({ stages: Object.entries(stages).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) })) }));
    expect(r.canSubmit).toBe(false);
    const loop = r.rules.find((x) => x.code === "RULE_CLOSED_LOOP")!;
    expect(loop.passed).toBe(false);
    expect(loop.fix).toContain("第5步");
  });

  it("声称AI质检但无判定标准同样视为没有闭环", () => {
    const stages = { ...fullStages, 5: { ...fullStages[5], judgmentSource: "由另一个AI判断好坏" } };
    const r = runHardRules(base({ stages: Object.entries(stages).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) })) }));
    expect(r.rules.find((x) => x.code === "RULE_CLOSED_LOOP")!.passed).toBe(false);
  });

  it("测试不足5例或覆盖不全时阻塞", () => {
    const r = runHardRules(base({ testCases: fullTests.slice(0, 4) }));
    expect(r.canSubmit).toBe(false);
    expect(r.rules.find((x) => x.code === "RULE_TESTS")!.passed).toBe(false);
  });

  it("检出敏感信息时阻塞并给出解除方式", () => {
    const stages = { ...fullStages, 5: { ...fullStages[5], inputInfo: "密码: hunter2example" } };
    const r = runHardRules(base({ stages: Object.entries(stages).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) })) }));
    const rule = r.rules.find((x) => x.code === "RULE_SENSITIVE")!;
    expect(rule.passed).toBe(false);
    expect(rule.fix).toContain("脱敏");
  });

  it("原创披露缺失时阻塞", () => {
    const r = runHardRules(base({ team: { ...fullTeam, externalResources: "", addedDuringActivity: "" } }));
    expect(r.rules.find((x) => x.code === "RULE_ORIGINALITY")!.passed).toBe(false);
  });

  it("未选赛道时阻塞", () => {
    const r = runHardRules(base({ track: null }));
    expect(r.rules.find((x) => x.code === "RULE_TRACK")!.passed).toBe(false);
  });
});

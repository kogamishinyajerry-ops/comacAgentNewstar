import { describe, expect, it } from "vitest";
import { computeProjectProgress, blockerSummary } from "../lib/progress";
import type { ProjectBundleLike } from "../lib/progress";

const stagesOf = (map: Record<number, Record<string, unknown>>) =>
  Object.entries(map).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) }));

const s4 = { targetUser: "新员工", scenario: "拼说明", frequency: "每周2次", currentProcess: "手工", worstStep: "对错行", currentCost: "2小时", whyWorth: "减错" };
const s5 = { usableResult: "10分钟", unacceptableErrors: "遗漏", judgmentSource: "原始记录", inputInfo: "CSV", outputFormat: "MD", stopConditions: "行数不符", initialTestCases: "3个" };
const s6 = { oneSentenceMvp: "自动对比", coreUser: "我", coreProblem: "手工", coreLoop: "闭环", verifiableMetric: "40→10", aiResponsibility: "草稿", humanResponsibility: "核对", autoCheckScope: "数量", humanConfirmPoint: "发出前", finalOwner: "本人", tools: "GLM", notDoing: "直连" };
const s6NoLoop = { ...s6, autoCheckScope: "", humanConfirmPoint: "", finalOwner: "" };

const fullTeam = { startTime: "2026-08", existingBase: "无", addedDuringActivity: "全部", externalResources: "GLM", helpers: "无" };
const mkTests = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `案例${i + 1}`,
    type: i === 0 ? "NORMAL" : i === 1 ? "BOUNDARY" : i === 2 ? "FAILURE" : "NORMAL",
    input: "a", expected: "b",
  }));

const bundle = (over: Partial<ProjectBundleLike> = {}): ProjectBundleLike => ({
  project: { title: "T", track: "process-automation", status: "DRAFT", createdAt: "2026-08-20T10:00:00Z", submittedAt: null },
  team: { ...fullTeam },
  stages: stagesOf({ 1: { agreeRules: true, agreeDataSafety: true, agreeOriginality: true }, 4: s4, 5: s5, 6: s6 }),
  testCases: mkTests(5),
  ...over,
});

describe("computeProjectProgress 整体进度", () => {
  it("空项目进度接近0且第一步指向合规勾选", () => {
    const p = computeProjectProgress({ project: { title: "T", track: null, status: "DRAFT", createdAt: "2026-08-20T10:00:00Z", submittedAt: null }, team: {}, stages: [], testCases: [] });
    expect(p.overallPct).toBeLessThanOrEqual(5);
    expect(p.currentStep).toBe(1);
    expect(p.nextHint).toContain("合规勾选");
    expect(p.steps[0].status).toBe("todo");
  });

  it("材料齐备时进度99且指向第9步预检", () => {
    const p = computeProjectProgress(bundle(), { feedbackCount: 1 });
    expect(p.overallPct).toBeGreaterThanOrEqual(85);
    expect(p.currentStep).toBe(9);
    expect(p.nextHint).toContain("预检");
    expect(p.urgent).toBe(false);
  });

  it("已提交作品进度100", () => {
    const p = computeProjectProgress(bundle({ project: { title: "T", track: "process-automation", status: "SUBMITTED", createdAt: "2026-08-20T10:00:00Z", submittedAt: "2026-09-01T10:00:00Z" } }));
    expect(p.overallPct).toBe(100);
    expect(p.nextHint).toContain("等待");
  });

  it("退回状态优先提示处理退回意见", () => {
    const p = computeProjectProgress(bundle({ project: { title: "T", track: "x", status: "RETURNED", returnReason: "补失败案例", createdAt: "2026-08-20T10:00:00Z", submittedAt: null } }));
    expect(p.nextHint).toContain("退回");
    expect(p.currentStep).toBe(9);
    expect(p.urgent).toBe(true);
  });
});

describe("求证闭环红线在进度中的表现", () => {
  it("五要素缺失时对应步骤标记blocked并给出红线下一步", () => {
    const p = computeProjectProgress(bundle({ stages: stagesOf({ 1: { agreeRules: true, agreeDataSafety: true, agreeOriginality: true }, 4: s4, 5: s5, 6: s6NoLoop }) }));
    expect(p.steps.find((x) => x.step === 6)!.status).toBe("blocked");
    expect(p.closedLoopOk).toBe(false);
    expect(p.nextHint).toContain("求证闭环");
    expect(p.urgent).toBe(true);
    expect(p.currentStep).toBe(6);
  });
});

describe("测试与披露", () => {
  it("测试不足5例时提示第8步", () => {
    const p = computeProjectProgress(bundle({ testCases: mkTests(3) }));
    expect(p.nextHint).toContain("第8步");
    expect(p.currentStep).toBe(8);
    expect(p.tests.passOk).toBe(false);
  });

  it("披露缺失时优先提示第2步", () => {
    const p = computeProjectProgress(bundle({ team: { ...fullTeam, externalResources: "" } }));
    expect(p.nextHint).toContain("第2步");
    expect(p.disclosureOk).toBe(false);
  });
});

describe("停滞天数", () => {
  it("按最后活动时间计算", () => {
    const now = new Date("2026-08-30T10:00:00Z");
    const p = computeProjectProgress(bundle({ stageTimes: ["2026-08-28T10:00:00Z"] }), { now });
    expect(p.staleDays).toBe(2);
  });
});

describe("blockerSummary 组织者摘要", () => {
  it("草稿按优先级给卡点", () => {
    const p = computeProjectProgress(bundle({ testCases: mkTests(2) }));
    expect(blockerSummary(p, "DRAFT")).toMatch(/测试\d\/5|第8步/);
  });
  it("退回/已提交状态优先", () => {
    const p = computeProjectProgress(bundle());
    expect(blockerSummary(p, "RETURNED")).toBe("退回待处理");
    expect(blockerSummary(p, "SUBMITTED")).toBe("已提交");
  });
});

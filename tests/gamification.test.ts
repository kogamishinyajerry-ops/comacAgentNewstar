import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, evaluateAchievements, levelOf, levelProgress, nextLevel } from "../lib/gamification";
import type { AchievementState } from "../lib/gamification";
import type { ProjectProgress, StepStatus } from "../lib/progress";
import { computeProjectProgress } from "../lib/progress";

const mkSteps = (statuses: Partial<Record<number, StepStatus>> = {}): ProjectProgress["steps"] =>
  Array.from({ length: 10 }, (_, i) => ({
    step: i + 1,
    title: `第${i + 1}步`,
    status: (statuses[i + 1] ?? "todo") as StepStatus,
    pct: statuses[i + 1] === "done" ? 100 : 0,
    missing: [],
  }));

const progressOf = (over: Partial<ProjectProgress> = {}): ProjectProgress => ({
  overallPct: 50,
  steps: mkSteps({ 1: "done", 4: "done", 5: "done", 6: "done" }),
  currentStep: 5,
  nextHint: "下一步",
  urgent: false,
  tests: { count: 5, passOk: true, coverageOk: true },
  closedLoopOk: true,
  disclosureOk: true,
  lastActiveAt: new Date().toISOString(),
  staleDays: 0,
  ...over,
});

describe("段位", () => {
  it("按进度映射段位,提交直通大师", () => {
    expect(levelOf(0, false).lv).toBe(1);
    expect(levelOf(25, false).lv).toBe(2);
    expect(levelOf(45, false).lv).toBe(3);
    expect(levelOf(65, false).lv).toBe(4);
    expect(levelOf(85, false).lv).toBe(5);
    expect(levelOf(99, false).lv).toBe(5);
    expect(levelOf(50, true).name).toBe("解法大师");
  });

  it("段位内XP进度与下一档", () => {
    expect(levelProgress(50, false)).toBe(50);
    expect(nextLevel(50, false)?.lv).toBe(4);
    expect(levelProgress(50, true)).toBe(100);
    expect(nextLevel(50, true)).toBeNull();
  });
});

describe("成就", () => {
  const state = (over: Partial<AchievementState> = {}): AchievementState => ({
    progress: progressOf(),
    teamExists: true,
    feedbackCount: 1,
    hasSnapshot: false,
    submitted: false,
    hasDocumentedFailure: true,
    ...over,
  });
  const ids = (s: AchievementState) => evaluateAchievements(s).map((a) => a.id);

  it("材料齐备的队伍解锁主要成就", () => {
    const got = ids(state());
    for (const want of ["first-team", "rules-keeper", "truth-seeker", "loop-master", "five-tests", "failure-honest", "first-diagnosis"]) {
      expect(got).toContain(want);
    }
    expect(got).not.toContain("submitted");
  });

  it("未组队/未诊断不点亮对应成就", () => {
    const got = ids(state({ teamExists: false, feedbackCount: 0 }));
    expect(got).not.toContain("first-team");
    expect(got).not.toContain("first-diagnosis");
  });

  it("提交后解锁 提交+快照 成就", () => {
    const got = ids(state({ submitted: true, hasSnapshot: true }));
    expect(got).toContain("submitted");
    expect(got).toContain("precheck-pass");
  });

  it("成就总数固定且id唯一", () => {
    expect(ACHIEVEMENTS).toHaveLength(11);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});

describe("进度引擎与段位联动", () => {
  it("空项目是Lv1,齐备草稿接近Lv5", () => {
    const empty = computeProjectProgress({
      project: { title: "t", track: null, status: "DRAFT", createdAt: new Date(), submittedAt: null },
      team: {},
      stages: [],
      testCases: [],
    });
    expect(levelOf(empty.overallPct, false).lv).toBe(1);

    const done = computeProjectProgress({
      project: { title: "t", track: "process-automation", status: "DRAFT", createdAt: new Date(), submittedAt: null },
      team: { startTime: "a", existingBase: "b", addedDuringActivity: "c", externalResources: "d", helpers: "e" },
      stages: [
        { step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) },
        {
          step: 4,
          data: JSON.stringify({ targetUser: "a", scenario: "b", frequency: "c", currentProcess: "d", worstStep: "e", currentCost: "f", whyWorth: "g" }),
        },
        {
          step: 5,
          data: JSON.stringify({ usableResult: "a", unacceptableErrors: "b", judgmentSource: "c", inputInfo: "d", outputFormat: "e", stopConditions: "f", initialTestCases: "g" }),
        },
        {
          step: 6,
          data: JSON.stringify({ oneSentenceMvp: "a", coreUser: "b", coreProblem: "c", coreLoop: "d", verifiableMetric: "e", aiResponsibility: "f", humanResponsibility: "g", autoCheckScope: "h", humanConfirmPoint: "i", finalOwner: "j", tools: "k", notDoing: "l" }),
        },
      ],
      testCases: Array.from({ length: 5 }, (_, i) => ({
        name: `c${i}`,
        type: i === 0 ? "NORMAL" : i === 1 ? "BOUNDARY" : i === 2 ? "FAILURE" : "NORMAL",
        input: "a",
        expected: "b",
        ...(i === 2 ? { failureReason: "如实记录" } : {}),
      })),
    }, { feedbackCount: 2 });
    expect(levelOf(done.overallPct, false).lv).toBeGreaterThanOrEqual(4);
  });
});

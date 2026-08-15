import { describe, expect, it } from "vitest";
import { buildDemoScript, buildExperimentCard, buildVisibleResultChecklist } from "../lib/deliverables";

const input = {
  title: "变更对比说明小助手",
  teamName: "艾的实验小队",
  memberNames: ["小艾"],
  team: {
    memberCount: 1,
    startTime: "2026-08-20",
    existingBase: "无",
    addedDuringActivity: "全部",
    externalResources: "GLM API",
    helpers: "无",
  },
  track: "process-automation",
  stages: [
    { step: 4, data: JSON.stringify({ targetUser: "新员工", scenario: "拼说明", worstStep: "对错行", currentCost: "2小时", whyWorth: "减错", frequency: "每周", currentProcess: "手工" }) },
    { step: 5, data: JSON.stringify({ usableResult: "10分钟确认", unacceptableErrors: "遗漏", judgmentSource: "原始记录", stopConditions: "行数不符" }) },
    { step: 6, data: JSON.stringify({ oneSentenceMvp: "自动整理对比", coreLoop: "输入→处理→检查→确认→输出", verifiableMetric: "40→10分钟", aiResponsibility: "草稿", autoCheckScope: "数量", humanConfirmPoint: "发出前", finalOwner: "本人", notDoing: "不做直连" }) },
  ],
  testCases: [
    { name: "常规", type: "NORMAL", input: "a", expected: "b", actual: "b", verdict: "PASS" },
    { name: "空输入", type: "FAILURE", input: "", expected: "停止", actual: "停止", verdict: "FAIL", failureReason: "未设停止", manualFix: "加了停止条件" },
  ],
};

describe("小实验卡", () => {
  it("包含五个部分与求证闭环字段", () => {
    const card = buildExperimentCard(input);
    expect(card.header.title).toBe("变更对比说明小助手");
    const headings = card.sections.map((s) => s.heading).join("|");
    expect(headings).toContain("真问题");
    expect(headings).toContain("判定标准");
    expect(headings).toContain("MVP与求证闭环");
    expect(headings).toContain("测试证据");
    expect(headings).toContain("原创与披露");
    const loopSection = card.sections[2];
    expect(loopSection.rows.some((r) => r.label === "最终责任人")).toBe(true);
  });
});

describe("90秒Demo脚本", () => {
  it("四段带时间轴且包含失败案例", () => {
    const script = buildDemoScript(input);
    expect(script).toHaveLength(4);
    expect(script[0].time).toContain("00:00");
    const evidence = script[2].lines.join("");
    expect(evidence).toContain("空输入");
  });
});

describe("可见结果清单", () => {
  it("覆盖链接/截图/提示词等类型", () => {
    const list = buildVisibleResultChecklist();
    expect(list.map((i) => i.key)).toContain("link");
    expect(list.map((i) => i.key)).toContain("screenshots");
    expect(list.map((i) => i.key)).toContain("prompts");
  });
});

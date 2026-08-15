import { describe, expect, it } from "vitest";
import { chatTurn, CHAT_OPENING, type BrainBundle } from "../lib/llm/chat-brain";

const bundle = (over: Partial<BrainBundle> = {}): BrainBundle => ({
  project: { track: null },
  stages: [],
  ...over,
});

const team = { startTime: "x", existingBase: "x", addedDuringActivity: "x", externalResources: "x", helpers: "x" };

describe("chatTurn 面试状态机", () => {
  it("无历史时,先问活动承诺", () => {
    const t = chatTurn({ bundle: bundle(), team, lastTarget: null, message: "我想做个东西" });
    expect(t.nextTarget).toMatchObject({ step: 1, key: "agreeRules" });
    expect(t.reply).toContain("底线");
  });

  it("答\"同意\"点亮三项承诺并推进到下一空位", () => {
    const t = chatTurn({ bundle: bundle(), team, lastTarget: { step: 1, key: "agreeRules" }, message: "同意" });
    expect(t.updates).toHaveLength(3);
    expect(t.updates[0]).toMatchObject({ step: 1, key: "agreeRules", value: true });
    expect(t.nextTarget?.step).toBe(3); // team已满→赛道
  });

  it("团队披露字段按目标落位", () => {
    const t = chatTurn({ bundle: bundle(), team: {}, lastTarget: { step: 2, key: "startTime" }, message: "8月20号开始" });
    expect(t.updates).toEqual([{ step: 2, key: "startTime", value: "8月20号开始" }]);
  });

  it("赛道按名称模糊识别,识别失败时列出四选项", () => {
    const ok = chatTurn({ bundle: bundle(), team, lastTarget: { step: 3, key: "track" }, message: "就做知识问答" });
    expect(ok.updates[0].value).toBe("知识问答助手");
    const bad = chatTurn({ bundle: bundle(), team, lastTarget: { step: 3, key: "track" }, message: "随便" });
    expect(bad.reply).toContain("四个正式赛道");
  });

  it("第4步:问场景答了频率,语义路由拨回frequency并触发拷问", () => {
    const t = chatTurn({ bundle: bundle(), team, lastTarget: { step: 4, key: "scenario" }, message: "大概每周几次吧" });
    expect(t.updates[0].key).toBe("frequency");
    expect(t.grill?.q).toMatch(/估的|数过/);
  });

  it("第4步:正常答案落到目标字段并推进", () => {
    const b = bundle({
      project: { track: "knowledge-qa" },
      stages: [
        { step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) },
        { step: 4, data: JSON.stringify({ targetUser: "新员工" }) },
      ],
    });
    const t = chatTurn({ bundle: b, team, lastTarget: { step: 4, key: "scenario" }, message: "查报销要翻三个文档" });
    expect(t.updates[0]).toEqual({ step: 4, key: "scenario", value: "查报销要翻三个文档" });
    expect(t.nextTarget?.key).toBe("frequency");
  });

  it("AI职责越界的回答触发责任拷问", () => {
    const t = chatTurn({ bundle: bundle(), team, lastTarget: { step: 6, key: "aiResponsibility" }, message: "AI负责最终放行" });
    expect(t.grill?.q).toMatch(/算谁的/);
  });

  it("4-6步填满后引导去结构视图第8步", () => {
    const full4to6 = [4, 5, 6].map((step) => ({
      step,
      data: JSON.stringify(
        Object.fromEntries(
          (step === 4 ? ["targetUser", "scenario", "frequency", "currentProcess", "worstStep", "currentCost", "whyWorth"]
            : step === 5 ? ["usableResult", "unacceptableErrors", "judgmentSource", "inputInfo", "outputFormat", "stopConditions", "initialTestCases"]
            : ["oneSentenceMvp", "coreUser", "coreProblem", "coreLoop", "verifiableMetric", "aiResponsibility", "humanResponsibility", "autoCheckScope", "humanConfirmPoint", "finalOwner", "tools", "notDoing"]
          ).map((k) => [k, "x"])
        )
      ),
    }));
    const b = bundle({
      project: { track: "knowledge-qa" },
      stages: [{ step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) }, ...full4to6],
    });
    const t = chatTurn({ bundle: b, team, lastTarget: null, message: "然后呢" });
    expect(t.action).toBe("open-structure-8");
  });

  it("开场信非空且口吻是面试官", () => {
    expect(CHAT_OPENING).toContain("我不打算给你一张表格");
    expect(CHAT_OPENING).toContain("追问");
  });
});

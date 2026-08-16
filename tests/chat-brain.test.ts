import { describe, expect, it } from "vitest";
import { chatTurn, CHAT_OPENING, parseFocus, parseTestCaseCommand, parseTestCaseStory, type BrainBundle } from "../lib/llm/chat-brain";

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

  it("4-6步填满后邀请口述测试(不再打发去表格)", () => {
    const b = fullCoreBundle();
    const t = chatTurn({ bundle: b, team, lastTarget: null, message: "然后呢" });
    expect(t.action).toBeUndefined();
    expect(t.nextTarget).toMatchObject({ step: 8, key: "testCase" });
    expect(t.reply).toContain("讲测试");
  });

  it("开场信非空且口吻是面试官", () => {
    expect(CHAT_OPENING).toContain("我不打算给你一张表格");
    expect(CHAT_OPENING).toContain("追问");
  });
});

/** 4-6步全满的bundle(口述测试阶段的前提) */
function fullCoreBundle(testCases?: { type: string }[]): BrainBundle {
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
  return bundle({
    project: { track: "knowledge-qa" },
    stages: [{ step: 1, data: JSON.stringify({ agreeRules: true, agreeDataSafety: true, agreeOriginality: true }) }, ...full4to6],
    testCases,
  });
}

describe("parseTestCaseStory 口述拆解", () => {
  it("失败故事 → FAILURE,拆出输入/预期/失败原因", () => {
    const c = parseTestCaseStory("给两份行数对不上的导出。结果它崩了,应该报错并停下来。因为没做行数校验");
    expect(c?.type).toBe("FAILURE");
    expect(c?.input).toContain("行数对不上");
    expect(c?.expected).toContain("应该");
    expect(c?.failureReason).toContain("因为");
    expect(c?.name).toContain("失败例:");
  });

  it("中文逗号口述:前缀标签不污染输入,预期/输入各归位", () => {
    const c = parseTestCaseStory("失败的情况:两个文档说法不一致,它编了个折中答案,应该停下来提示人工裁定");
    expect(c?.type).toBe("FAILURE");
    expect(c?.input).toContain("两个文档说法不一致");
    expect(c?.input).not.toContain("失败的情况");
    expect(c?.expected).toContain("应该");
    expect(c?.expected).not.toEqual(c?.input);
  });

  it("不适用故事带原因:原因归failureReason,输入取主场景", () => {
    const c = parseTestCaseStory("不适用:拿它问绩效明细,它用不上,因为薪酬是敏感信息,期望直接拒绝");
    expect(c?.type).toBe("NA");
    expect(c?.failureReason).toContain("因为");
    expect(c?.input).toContain("绩效明细");
  });

  it("不适用/边界/常规 分型正确", () => {
    expect(parseTestCaseStory("输入是纸质单据,这个解法用不上,因为不接收纸质材料")?.type).toBe("NA");
    expect(parseTestCaseStory("同一天有一百条变更同时进来,期望10分钟内出结果")?.type).toBe("BOUNDARY");
    expect(parseTestCaseStory("给一份普通的变更记录,期望正常输出对比说明")?.type).toBe("NORMAL");
  });

  it("没有预期句时expected标待补充,name不超30字", () => {
    const c = parseTestCaseStory("就是一份很普通的输入数据没有什么特别的地方啊");
    expect(c?.expected).toBe("待补充");
    expect(c?.name.length).toBeLessThanOrEqual(30);
  });

  it("非测试故事(想不出/要去表格填)返回null", () => {
    expect(parseTestCaseStory("不知道")).toBeNull();
    expect(parseTestCaseStory("我去表格里填吧")).toBeNull();
    expect(parseTestCaseStory("嗯")).toBeNull();
  });
});

describe("口述测试状态机", () => {
  it("口述一例 → testCase对象落updates并邀请下一例(缺失败时优先要失败例)", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([{ type: "NORMAL" }, { type: "NORMAL" }]),
      team,
      lastTarget: { step: 8, key: "testCase" },
      message: "给一份常规变更记录,期望输出一页对比说明",
    });
    expect(t.updates[0]).toMatchObject({ step: 8, key: "testCase" });
    expect(t.updates[0].value).toMatchObject({ type: "NORMAL" });
    expect(t.nextTarget).toMatchObject({ step: 8, key: "testCase" });
    expect(t.reply).toMatch(/失败或不适用|失败例/);
  });

  it("口述缺预期的故事 → 追问预期(nextTarget=testCaseExpected)", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([]),
      team,
      lastTarget: { step: 8, key: "testCase" },
      message: "就是给它两份正常的导出文件没有什么特别的",
    });
    expect(t.nextTarget).toMatchObject({ step: 8, key: "testCaseExpected" });
  });

  it("补充预期 → testCaseExpected更新;5例覆盖齐 → 引导预检", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([
        { type: "NORMAL" }, { type: "NORMAL" }, { type: "BOUNDARY" }, { type: "FAILURE" }, { type: "NA" },
      ]),
      team,
      lastTarget: { step: 8, key: "testCaseExpected" },
      message: "应该输出完整对比说明",
    });
    expect(t.updates[0]).toEqual({ step: 8, key: "testCaseExpected", value: "应该输出完整对比说明" });
    expect(t.action).toBe("run-precheck");
    expect(t.nextTarget).toBeNull();
  });

  it("第5例覆盖补齐 → run-precheck动作", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([{ type: "NORMAL" }, { type: "NORMAL" }, { type: "BOUNDARY" }, { type: "FAILURE" }]),
      team,
      lastTarget: { step: 8, key: "testCase" },
      message: "纸质单据场景不适用,因为没有纸质材料,期望直接跳过",
    });
    expect(t.action).toBe("run-precheck");
    expect(t.reply).toContain("已落表");
  });

  it("讲不出来 → 不强迫,引导第8步表格", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([]),
      team,
      lastTarget: { step: 8, key: "testCase" },
      message: "我想去表格里填",
    });
    expect(t.action).toBe("open-structure-8");
  });

  it("测试已齐时再来消息 → 直接引导预检", () => {
    const t = chatTurn({
      bundle: fullCoreBundle([
        { type: "NORMAL" }, { type: "NORMAL" }, { type: "BOUNDARY" }, { type: "FAILURE" }, { type: "NA" },
      ]),
      team,
      lastTarget: null,
      message: "然后呢",
    });
    expect(t.action).toBe("run-precheck");
  });
});

describe("parseTestCaseCommand 对话内改删指令", () => {
  it("删除指令:第N例/最后一例", () => {
    expect(parseTestCaseCommand("删掉第2例")).toEqual({ op: "delete", index: 2 });
    expect(parseTestCaseCommand("最后一例不要了")).toEqual({ op: "delete", index: "last" });
    expect(parseTestCaseCommand("刚才那例删了")).toEqual({ op: "delete", index: "last" });
  });

  it("修改指令:预期与名称", () => {
    expect(parseTestCaseCommand("第2例的预期是输出两条对比")).toEqual({ op: "patch", index: 2, patch: { expected: "输出两条对比" } });
    expect(parseTestCaseCommand("第3例预期改成应该停下来")).toEqual({ op: "patch", index: 3, patch: { expected: "应该停下来" } });
    expect(parseTestCaseCommand("第1例改名叫常规查询")).toEqual({ op: "patch", index: 1, patch: { name: "常规查询" } });
    expect(parseTestCaseCommand("最后一例的名称改为敏感输入")).toEqual({ op: "patch", index: "last", patch: { name: "敏感输入" } });
  });

  it("非指令返回null", () => {
    expect(parseTestCaseCommand("讲一个失败的情况,它崩了")).toBeNull();
    expect(parseTestCaseCommand("删")).toBeNull();
    expect(parseTestCaseCommand("再讲一例常规的")).toBeNull();
  });
});

describe("口述测试的对话内编辑", () => {
  const twoCases = [
    { type: "NORMAL", name: "常规查询" },
    { type: "FAILURE", name: "文档冲突" },
  ];

  it("删掉第2例 → testCaseDelete 更新,回复点名案例", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: { step: 8, key: "testCase" }, message: "第2例删掉" });
    expect(t.updates[0]).toEqual({ step: 8, key: "testCaseDelete", value: "2" });
    expect(t.reply).toContain("文档冲突");
    expect(t.reply).toContain("还差4例");
  });

  it("改第1例预期 → testCasePatch 更新", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: { step: 8, key: "testCase" }, message: "第1例的预期是正确回答并给出出处" });
    expect(t.updates[0]).toEqual({ step: 8, key: "testCasePatch", value: { index: 1, patch: { expected: "正确回答并给出出处" } } });
    expect(t.reply).toContain("常规查询");
  });

  it("删掉最后一例 → value=last", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: { step: 8, key: "testCase" }, message: "最后一例删掉" });
    expect(t.updates[0]).toEqual({ step: 8, key: "testCaseDelete", value: "last" });
  });

  it("越界序号 → 不产生更新,回复澄清", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: { step: 8, key: "testCase" }, message: "删掉第5例" });
    expect(t.updates).toHaveLength(0);
    expect(t.reply).toContain("现在共2例");
  });

  it("提到第N例但指令不明 → 澄清而非误当新故事", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: { step: 8, key: "testCase" }, message: "第1例怎么样" });
    expect(t.updates).toHaveLength(0);
    expect(t.reply).toMatch(/想对这一例做什么/);
  });

  it("未受邀(lastTarget为空)也能直接下编辑指令——重说覆盖后的第一句", () => {
    const t = chatTurn({ bundle: fullCoreBundle(twoCases), team, lastTarget: null, message: "第1例的预期是正确回答并给出处" });
    expect(t.updates[0]).toMatchObject({ step: 8, key: "testCasePatch", value: { index: 1 } });
  });

  it("无案例时下编辑指令 → 引导先口述", () => {
    const t = chatTurn({ bundle: fullCoreBundle([]), team, lastTarget: null, message: "第1例删掉" });
    expect(t.updates).toHaveLength(0);
    expect(t.reply).toContain("还没有案例");
  });

  it("未受邀直接口述(带明确预期) → 直接落表,不出邀请", () => {
    const t = chatTurn({ bundle: fullCoreBundle([]), team, lastTarget: null, message: "问一句差旅住宿标准,期望给出答案并附出处" });
    expect(t.updates[0]).toMatchObject({ step: 8, key: "testCase" });
    expect(t.reply).toContain("已落表");
  });

  it("闲聊(无明确信号)不会被误记成案例 → 仍然邀请口述", () => {
    const t = chatTurn({ bundle: fullCoreBundle([]), team, lastTarget: null, message: "材料都填好了,我们继续吧" });
    expect(t.updates).toHaveLength(0);
    expect(t.reply).toContain("讲测试");
  });

  it("未受邀口述失败例(类型关键词明确) → 直接落表", () => {
    const t = chatTurn({ bundle: fullCoreBundle([]), team, lastTarget: null, message: "两份文档说法不一致的时候它出错了" });
    expect(t.updates[0]?.value).toMatchObject({ type: "FAILURE" });
  });
});

describe("parseFocus 重说路由", () => {
  it("合法焦点:4-6字段/团队披露/赛道", () => {
    expect(parseFocus("4.targetUser")).toEqual({ step: 4, key: "targetUser" });
    expect(parseFocus("6.finalOwner")).toEqual({ step: 6, key: "finalOwner" });
    expect(parseFocus("2.startTime")).toEqual({ step: 2, key: "startTime" });
    expect(parseFocus("3.track")).toEqual({ step: 3, key: "track" });
  });

  it("非法焦点:不存在步骤/不存在字段/乱串", () => {
    expect(parseFocus("8.testCase")).toBeNull();
    expect(parseFocus("4.noSuchKey")).toBeNull();
    expect(parseFocus("abc")).toBeNull();
    expect(parseFocus("")).toBeNull();
    expect(parseFocus(undefined)).toBeNull();
  });

  it("焦点字段作为lastTarget定向覆盖(重说场景)", () => {
    const t = chatTurn({
      bundle: fullCoreBundle(),
      team,
      lastTarget: parseFocus("4.scenario"),
      message: "换个说法:评审前要手动拼三份系统的变更记录",
    });
    expect(t.updates[0]).toEqual({ step: 4, key: "scenario", value: "换个说法:评审前要手动拼三份系统的变更记录" });
  });
});

// 阶段一:Coach 三幕确定性状态机(纯函数)
import { describe, expect, it } from "vitest";
import {
  ACT_COUNT,
  advance,
  clearError,
  composeReviewRounds,
  composeSeed,
  composeSeedText,
  createCoachState,
  currentAct,
  excerpt,
  isSubmittableAnswer,
  miniSlots,
  startArtifact,
  submitAnswer,
  visualStateFor,
} from "../lib/hub/coach-machine";
import { coachDemoActs } from "../fixtures/coach-demo";

describe("coach-machine:三幕推进", () => {
  it("两条入口各三幕,幕数一致", () => {
    expect(ACT_COUNT).toBe(3);
    expect(coachDemoActs.problem.length).toBe(3);
    expect(coachDemoActs.idea.length).toBe(3);
  });

  it("空白提交不推进,给出当前幕的行内提示", () => {
    let s = createCoachState("problem");
    s = submitAnswer(s, "   ");
    expect(s.phase).toBe("question");
    expect(s.actIndex).toBe(0);
    expect(s.error).toBe(coachDemoActs.problem[0].emptyHint);
    expect(s.answers).toHaveLength(0);

    s = clearError(s);
    expect(s.error).toBeNull();
  });

  it("每次有效提交推进一幕;第三幕后凝结为种子", () => {
    let s = createCoachState("problem");
    expect(s.phase).toBe("question");

    s = submitAnswer(s, "试验异常记录分散在三处");
    expect(s.phase).toBe("transition");
    s = advance(s);
    expect(s.phase).toBe("question");
    expect(s.actIndex).toBe(1);
    expect(currentAct(s).question).toBe(coachDemoActs.problem[1].question);

    s = advance(submitAnswer(s, "影响试验工程师,对账多花两小时"));
    expect(s.actIndex).toBe(2);

    s = advance(submitAnswer(s, "需要记住口径并调用工具核对"));
    expect(s.phase).toBe("seed");
    expect(s.answers).toHaveLength(3);
    // seed 是终态:再提交无效果
    expect(submitAnswer(s, "多余回答").phase).toBe("seed");
  });

  it("transition 之外调用 advance 不改变状态", () => {
    const s = createCoachState("idea");
    expect(advance(s)).toBe(s);
  });
});

describe("coach-machine:视觉状态派生", () => {
  it("question → idle;非末幕 transition → challenging;末幕 transition → condensing;seed → confirmed", () => {
    let s = createCoachState("problem");
    expect(visualStateFor(s)).toBe("idle");

    s = submitAnswer(s, "回答一");
    expect(visualStateFor(s)).toBe("challenging");
    s = advance(s);

    s = submitAnswer(s, "回答二");
    s = advance(s);
    s = submitAnswer(s, "回答三");
    expect(visualStateFor(s)).toBe("condensing");
    s = advance(s);
    expect(visualStateFor(s)).toBe("confirmed");
  });
});

describe("coach-machine:问题种子合成", () => {
  it("种子由三段回答摘录组成,并固定标注两类缺口", () => {
    let s = createCoachState("idea");
    for (const a of ["现象一", "影响二", "必要性三"]) {
      s = advance(submitAnswer(s, a));
    }
    const seed = composeSeed(s);
    expect(seed.moment).toBe("现象一");
    expect(seed.impact).toBe("影响二");
    expect(seed.necessity).toBe("必要性三");
    expect(seed.gaps.length).toBeGreaterThanOrEqual(2);
    // 种子不是"项目创建成功"式文案
    expect(JSON.stringify(seed)).not.toContain("创建成功");
  });

  it("excerpt 压缩空白并截断超长回答", () => {
    expect(excerpt("  a\n b  c ")).toBe("a b c");
    const long = "很".repeat(100);
    expect(excerpt(long, 20)).toHaveLength(20);
    expect(excerpt(long, 20).endsWith("……")).toBe(true);
  });


  it("种子纯文本导出重组既有槽位,不新增结论", () => {
    const seed = {
      moment: "试验异常记录分散在三处",
      impact: "工程师每次对账多花两小时",
      necessity: "需要按流程调用检索工具留痕",
      gaps: ["影响面尚未量化", "证据尚未接回"],
    };
    const text = composeSeedText(seed);
    expect(text).toContain("问题种子");
    expect(text).toContain("【主张】");
    expect(text).toContain("想改变的瞬间:试验异常记录分散在三处");
    expect(text).toContain("影响与损失:工程师每次对账多花两小时");
    expect(text).toContain("◇ 影响面尚未量化");
    // 只重组、不判断:导出不得出现肯定式完成表述;
    // 副标题的"不是项目创建成功"是诚实声明,属于期望内容
    expect(text).toContain("不是项目创建成功");
    expect(text).not.toContain("项目已创建");
    expect(text).not.toContain("已提交");
  });
});

describe("coach-machine:输入判定", () => {
  it("只有非空白内容可提交", () => {
    expect(isSubmittableAnswer("")).toBe(false);
    expect(isSubmittableAnswer(" \n\t ")).toBe(false);
    expect(isSubmittableAnswer("一句话")).toBe(true);
  });
});

describe("coach-machine:两条入口的人格红线", () => {
  it("真实问题入口第一问问具体工作瞬间", () => {
    expect(coachDemoActs.problem[0].question).toBe("你最想改变的具体工作瞬间是什么?");
  });

  it("已有想法入口第一问必须挑战方案先行,不直接认可功能设想", () => {
    expect(coachDemoActs.idea[0].question).toContain("先不要描述功能");
    expect(coachDemoActs.idea[0].risk).toContain("方案先行");
  });

  it("每一幕都包含判断/风险/问题/占位提示,且无泛化夸奖词", () => {
    for (const acts of [coachDemoActs.problem, coachDemoActs.idea]) {
      for (const act of acts) {
        expect(act.judgment.length).toBeGreaterThan(6);
        expect(act.risk.length).toBeGreaterThan(6);
        expect(act.judgment).not.toMatch(/[?？]/);
        expect(act.risk).not.toMatch(/[?？]/);
        expect(act.question.match(/[?？]/g) ?? []).toHaveLength(1);
        expect(act.question.endsWith("?")).toBe(true);
        expect(act.placeholder.length).toBeGreaterThan(6);
      }
    }
    const all = JSON.stringify(coachDemoActs);
    for (const banned of ["非常棒", "太好了", "很棒", "厉害", "干得漂亮"]) {
      expect(all).not.toContain(banned);
    }
  });
});

describe("coach-machine:打磨轮⑥ 常驻问题卡与回看(§29)", () => {
  it("miniSlots:未作答时三幕槽全为幽灵,无深化槽", () => {
    const slots = miniSlots(createCoachState("problem"));
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.filled).toBe(false);
      expect(slot.text).toBeNull();
    }
    expect(slots.map((slot) => slot.key)).toEqual(["moment", "impact", "necessity"]);
  });

  it("miniSlots:按幕序点亮,摘录与轨迹同档(20 字),深化槽随回答追加", () => {
    let s = createCoachState("problem");
    s = submitAnswer(s, "试验异常记录、依据和处理结果分散在三处,对账要来回翻找");
    let slots = miniSlots(s);
    expect(slots.filter((slot) => slot.filled)).toHaveLength(1);
    const moment = slots[0];
    expect(moment.filled).toBe(true);
    /* 20 字截断加省略号:完整回答默认不可见的压缩原则不破 */
    expect(moment.text).not.toContain("对账要来回翻找");
    expect(moment.text?.endsWith("……")).toBe(true);

    s = advance(s);
    s = submitAnswer(s, "影响试验工程师与复核人,每次对账约多花两小时");
    s = advance(s);
    s = submitAnswer(s, "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕");
    s = advance(s);
    s = startArtifact(s);
    s = submitAnswer(s, "大约四十名试验工程师,每周对账三次,每次多花约两小时");
    slots = miniSlots(s);
    expect(slots).toHaveLength(4);
    expect(slots[3].key).toBe("deepening-0");
    expect(slots[3].filled).toBe(true);
    expect(slots.slice(0, 3).every((slot) => slot.filled)).toBe(true);
  });

  it("composeReviewRounds:空状态无轮次;完成后按幕/深化顺序携带全文与当前标记", () => {
    const actQuestions = ["问一?", "问二?", "问三?"];
    const artifactQuestions = ["深化一?", "深化二?", "深化三?"];
    expect(composeReviewRounds(createCoachState("problem"), actQuestions, artifactQuestions)).toEqual([]);

    let s = createCoachState("problem");
    s = submitAnswer(s, "答一");
    s = advance(s);
    /* 第二幕问题态:第一轮已答;当前位置由抽屉「当前」行表达,不在轮次上标记 */
    let rounds = composeReviewRounds(s, actQuestions, artifactQuestions);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ kind: "act", question: "问一?", answer: "答一" });
    expect("current" in rounds[0]).toBe(false);

    /* 三幕+两轮深化后:五轮全量,全文保留 */
    s = submitAnswer(s, "答二");
    s = advance(s);
    s = submitAnswer(s, "答三");
    s = advance(s);
    s = startArtifact(s);
    s = submitAnswer(s, "深答一");
    s = advance(s);
    s = submitAnswer(s, "深答二");
    s = advance(s);
    rounds = composeReviewRounds(s, actQuestions, artifactQuestions);
    expect(rounds).toHaveLength(5);
    expect(rounds.map((round) => round.kind)).toEqual(["act", "act", "act", "deepening", "deepening"]);
    /* 回答保留全文(抽屉默认关闭承接压缩原则) */
    expect(rounds[3].answer).toBe("深答一");
  });
});

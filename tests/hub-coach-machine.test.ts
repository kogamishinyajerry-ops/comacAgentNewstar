// 阶段一:Coach 三幕确定性状态机(纯函数)
import { describe, expect, it } from "vitest";
import {
  ACT_COUNT,
  advance,
  clearError,
  composeSeed,
  composeTrace,
  createCoachState,
  currentAct,
  excerpt,
  isSubmittableAnswer,
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

  it("结论轨迹是幕标签加短摘录,不含完整原回答", () => {
    const answer = "试验异常记录、依据和处理结果分散在三处,对账要来回翻找";
    const trace = composeTrace(0, answer);
    expect(trace.startsWith("问题:")).toBe(true);
    expect(trace.length).toBeLessThan(answer.length);
    expect(composeTrace(1, "短回答")).toBe("影响:短回答");
    expect(composeTrace(2, "需要工具")).toBe("Agent 必要性:需要工具");
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

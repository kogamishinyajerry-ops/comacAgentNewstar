// 阶段一:Coach 三幕确定性状态机(纯函数)
import { describe, expect, it } from "vitest";
import {
  ACT_COUNT,
  advance,
  beginCoach,
  clearError,
  composeReviewRounds,
  composeSeed,
  composeSeedText,
  createCoachState,
  createSessionCardId,
  currentAct,
  excerpt,
  formatLocalTimestamp,
  isSubmittableAnswer,
  miniSlots,
  startArtifact,
  submitAnswer,
  visualStateFor,
  type ExportMeta,
} from "../lib/hub/coach-machine";
import { coachDemoActs, coachDemoArtifactActs, exportTraceabilityCopy } from "../fixtures/coach-demo";

/** J-1 后:流程从建立拍开始,先 begin 才进入第一幕 */
function begunState(entry: "problem" | "idea" = "problem") {
  return beginCoach(createCoachState(entry));
}

const META: ExportMeta = {
  generatedAt: new Date(2026, 7, 20, 9, 5),
  cardId: "QD-T3ST5",
};

describe("coach-machine:建立拍(旅程叙事轮 J-1)", () => {
  it("初始相位是 intro;begin 进入第一幕,非 intro 相位调用不生效", () => {
    const intro = createCoachState("problem");
    expect(intro.phase).toBe("intro");
    expect(visualStateFor(intro)).toBe("idle");

    const begun = beginCoach(intro);
    expect(begun.phase).toBe("question");
    expect(begun.actIndex).toBe(0);
    /* 幂等防线:已离开建立拍后 begin 不再改变状态 */
    expect(beginCoach(begun)).toBe(begun);
  });

  it("建立拍不接受提交与推进,保持原状态", () => {
    const intro = createCoachState("idea");
    expect(submitAnswer(intro, "抢先回答")).toBe(intro);
    expect(advance(intro)).toBe(intro);
    expect(intro.answers).toHaveLength(0);
  });

  it("miniSlots 在建立拍即给出三格幽灵槽(与第一幕问题态同构)", () => {
    const slots = miniSlots(createCoachState("problem"));
    expect(slots).toHaveLength(3);
    expect(slots.every((slot) => !slot.filled && slot.text === null)).toBe(true);
  });
});

describe("coach-machine:三幕推进", () => {
  it("两条入口各三幕,幕数一致", () => {
    expect(ACT_COUNT).toBe(3);
    expect(coachDemoActs.problem.length).toBe(3);
    expect(coachDemoActs.idea.length).toBe(3);
  });

  it("空白提交不推进,给出当前幕的行内提示", () => {
    let s = begunState("problem");
    s = submitAnswer(s, "   ");
    expect(s.phase).toBe("question");
    expect(s.actIndex).toBe(0);
    expect(s.error).toBe(coachDemoActs.problem[0].emptyHint);
    expect(s.answers).toHaveLength(0);

    s = clearError(s);
    expect(s.error).toBeNull();
  });

  it("每次有效提交推进一幕;第三幕后凝结为种子", () => {
    let s = begunState("problem");
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
    const s = begunState("idea");
    expect(advance(s)).toBe(s);
  });
});

describe("coach-machine:视觉状态派生", () => {
  it("question → idle;非末幕 transition → challenging;末幕 transition → condensing;seed → confirmed", () => {
    let s = begunState("problem");
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
    let s = begunState("idea");
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


  it("种子纯文本导出重组既有槽位,不新增结论;头部内嵌可追述四行(P0-1)", () => {
    const seed = {
      moment: "试验异常记录分散在三处",
      impact: "工程师每次对账多花两小时",
      necessity: "需要按流程调用检索工具留痕",
      gaps: ["影响面尚未量化", "证据尚未接回"],
    };
    const text = composeSeedText(seed, META);
    expect(text).toContain("问题种子");
    expect(text).toContain("【主张】");
    expect(text).toContain("想改变的瞬间:试验异常记录分散在三处");
    expect(text).toContain("影响与损失:工程师每次对账多花两小时");
    expect(text).toContain("◇ 影响面尚未量化");
    /* P0-1 可追述头部:生成时间(本地时钟)/会话卡号/格式版本/问答映射 */
    expect(text).toContain("生成时间:2026-08-20 09:05(本地时钟)");
    expect(text).toContain("卡号:QD-T3ST5(本会话生成，未落库)");
    expect(text).toContain(`格式版本:${exportTraceabilityCopy.formatVersion}`);
    expect(text).toContain(`问答映射:${exportTraceabilityCopy.mappingSeed}`);
    expect(text).not.toContain(exportTraceabilityCopy.mappingArtifact);
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
    expect(coachDemoActs.problem[0].question).toBe("你最想改变的具体工作瞬间是什么？");
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
        expect(act.question.endsWith("？")).toBe(true);
        expect(act.placeholder.length).toBeGreaterThan(6);
      }
    }
    const all = JSON.stringify(coachDemoActs);
    for (const banned of ["非常棒", "太好了", "很棒", "厉害", "干得漂亮"]) {
      expect(all).not.toContain(banned);
    }
  });

  it("口吻红线(v2.0,⚑D2):判断与风险不含评委席框架词,业务拷问优先", () => {
    /* 口吻已切「懂 Agent 落地的业务专家」:业务拷问优先于评委视角引用 */
    const all = JSON.stringify(coachDemoActs) + JSON.stringify(coachDemoArtifactActs);
    expect(all).not.toContain("评委");
    /* 业务拷问优先:第二幕必问具体的人与损失 */
    expect(coachDemoActs.problem[1].question).toContain("谁");
    expect(coachDemoActs.problem[1].question).toContain("损失");
    /* Agent 必要性拷问自然带出:直接对照普通大模型聊天 */
    expect(coachDemoActs.problem[2].question).toContain("普通大模型聊天");
    /* 严苛但不羞辱:话术只否定表述,不否定人 */
    for (const insult of ["你没入门", "根本不成立", "水平太差", "不懂业务"]) {
      expect(all).not.toContain(insult);
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
    let s = begunState("problem");
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

  it("composeReviewRounds:空状态无轮次;完成后按幕/深化顺序携带全文、判断与风险(§32 I1)", () => {
    /* 每轮来源=实际端上的问题+过渡拍判断/风险;首轮无过渡拍为 null */
    const actSources = [
      { question: "问一?", judgment: null, risk: null },
      { question: "问二?", judgment: "判断二", risk: "风险二" },
      { question: "问三?", judgment: "判断三", risk: "风险三" },
    ];
    const artifactSources = [
      { question: "深化一?", judgment: null, risk: null },
      { question: "深化二?", judgment: "深判断二", risk: "深风险二" },
      { question: "深化三?", judgment: "深判断三", risk: "深风险三" },
    ];
    expect(composeReviewRounds(createCoachState("problem"), actSources, artifactSources)).toEqual([]);

    let s = begunState("problem");
    s = submitAnswer(s, "答一");
    s = advance(s);
    /* 第二幕问题态:第一轮已答;当前位置由抽屉「当前」行表达,不在轮次上标记 */
    let rounds = composeReviewRounds(s, actSources, artifactSources);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]).toMatchObject({ kind: "act", question: "问一?", answer: "答一" });
    /* 首轮无过渡拍:判断/风险为 null,抽屉不渲染 */
    expect(rounds[0].judgment).toBeNull();
    expect(rounds[0].risk).toBeNull();
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
    rounds = composeReviewRounds(s, actSources, artifactSources);
    expect(rounds).toHaveLength(5);
    expect(rounds.map((round) => round.kind)).toEqual(["act", "act", "act", "deepening", "deepening"]);
    /* 回答保留全文(抽屉默认关闭承接压缩原则) */
    expect(rounds[3].answer).toBe("深答一");
    /* 判断/风险随轮入史:第 2、3 幕与深化第 2 轮携带实际端上内容 */
    expect(rounds[1]).toMatchObject({ judgment: "判断二", risk: "风险二" });
    expect(rounds[2]).toMatchObject({ judgment: "判断三", risk: "风险三" });
    expect(rounds[3].judgment).toBeNull();
    expect(rounds[4]).toMatchObject({ judgment: "深判断二", risk: "深风险二" });
  });
});

describe("coach-machine:导出可追述过渡解(§31 P0-1,⚑D3)", () => {
  it("createSessionCardId:QD- 前缀 + 5 位无歧义字符;随机源可注入", () => {
    expect(createSessionCardId()).toMatch(/^QD-[A-HJ-KMNP-Z2-9]{5}$/);
    /* 注入确定性随机源:0 → 字母表首字符,0.999 → 末字符 */
    expect(createSessionCardId(() => 0)).toBe("QD-AAAAA");
    expect(createSessionCardId(() => 0.999)).toBe("QD-99999");
    /* 同一字符集不含易混淆的 0/O、1/I/L(31 字符表,0.5 → 索引 15 = S) */
    expect(createSessionCardId(() => 0.5)).toBe("QD-SSSSS");
  });

  it("formatLocalTimestamp:本地时钟 YYYY-MM-DD HH:mm,单位数补零", () => {
    expect(formatLocalTimestamp(new Date(2026, 0, 5, 9, 7))).toBe("2026-01-05 09:07");
    expect(formatLocalTimestamp(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31 23:59");
  });

  it("种子导出头部:时间/卡号/版本/映射四行齐全且先于三字段,不含深化映射", () => {
    const text = composeSeedText(
      { moment: "瞬间", impact: "影响", necessity: "必要性", gaps: ["缺口一"] },
      META,
    );
    const head = text.split("\n").slice(0, 7).join("\n");
    expect(head).toContain("生成时间:2026-08-20 09:05(本地时钟)");
    expect(head).toContain("卡号:QD-T3ST5(本会话生成，未落库)");
    expect(head).toContain("格式版本:v1");
    expect(head).toContain("问答映射:主张←第1·3幕；影响←第2幕");
    expect(text.indexOf("格式版本")).toBeLessThan(text.indexOf("【主张】"));
  });
});

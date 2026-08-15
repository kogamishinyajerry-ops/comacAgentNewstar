// 对话大脑(离线Mock):面试式状态机——一次只问一个字段,回答即提取。
// GLM模式下由提示词承担,此模块同时作为GLM解析失败的结构化兜底。

import { getStepConfig } from "../steps";
import { getStageData, rulesAgreed } from "../validation";
import { TEST_TYPE_LABELS } from "../constants";

/** 大脑所需的最小项目形状 */
export interface BrainBundle {
  stages: { step: number; data: string }[];
  project: { track: string | null };
  /** 第8步口述测试需要现状(计数与覆盖);缺省视为0例 */
  testCases?: { type: string }[];
}

/** 口述测试案例 → 结构化一行的中间形状(落库时补 verdict/sortOrder) */
export interface ParsedTestCase {
  name: string;
  type: "NORMAL" | "BOUNDARY" | "FAILURE" | "NA";
  input: string;
  expected: string;
  failureReason: string;
}

export interface ChatTurn {
  reply: string;
  updates: { step: number; key: string; value: string | boolean | ParsedTestCase }[];
  nextTarget: { step: number; key: string; label: string } | null;
  action?: "open-structure-8" | "run-precheck";
  grill?: { q: string; why: string } | null;
}

/** 口述测试的期望值占位:chat.ts 据此把后续补充写回最近一例 */
export const EXPECT_PENDING = "待补充";

const NA_RE = /不适用|用不上|无数据|没有这种|不存在这种|压根没有/;
const FAILURE_RE = /失败|出错|报错|错了|没成|不行|崩了?|异常|搞砸|翻车|出问题|识别错|编了|编出|瞎编|胡编/;
const BOUNDARY_RE = /边界|极端|最多|最少|超大|超长|同时|多条|重复|为空|空数据|只有一|只有1|最后一条|第一条|满负荷/;
const EXPECTED_RE = /(应该|应当|预期|期望|希望|理应|正确|合格|算对|对得上|算通过)/;
const REASON_RE = /(因为|由于|导致|结果是|所以)/;
const NOT_A_STORY_RE = /^(不知道|不会|想不出|没法|说不上|你(来|帮)|帮我想|怎么写)|去表格|表格里填|表格填|结构视图|先跳过|跳过这/;

/** 口述一个测试场景 → 拆成 名称/类型/输入/预期/失败原因。不是测试故事返回 null(纯函数,离线可用)。 */
export function parseTestCaseStory(msg: string): ParsedTestCase | null {
  const text = msg.trim();
  if (text.length < 6 || NOT_A_STORY_RE.test(text)) return null;
  // 口语以逗号/冒号推进,统一切分(前缀标签如"失败的情况:"会独立成短句,天然被排除)
  const sentences = text
    .split(/[。;.;;!?!\n,,::]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  if (!sentences.length) return null;

  const type: ParsedTestCase["type"] = NA_RE.test(text) ? "NA" : FAILURE_RE.test(text) ? "FAILURE" : BOUNDARY_RE.test(text) ? "BOUNDARY" : "NORMAL";
  const expectedSentence = sentences.find((s) => EXPECTED_RE.test(s)) ?? "";
  const reasonSentence = sentences.find((s) => s !== expectedSentence && REASON_RE.test(s)) ?? "";
  const rest = sentences.filter((s) => s !== expectedSentence && s !== reasonSentence).sort((a, b) => b.length - a.length);
  const input = (rest[0] ?? (expectedSentence || text)).slice(0, 300);
  const expected = expectedSentence ? expectedSentence.slice(0, 300) : EXPECT_PENDING;
  const failureFallback =
    type === "FAILURE"
      ? sentences
          .filter((s) => s !== expectedSentence && s !== input && FAILURE_RE.test(s))
          .sort((a, b) => b.length - a.length)[0] ?? ""
      : "";
  const failureReason =
    type === "FAILURE" || type === "NA" ? (reasonSentence || failureFallback).slice(0, 300) : "";
  const name = `${TEST_TYPE_LABELS[type]}例:${input.slice(0, 14)}`.slice(0, 30);
  return { name, type, input, expected, failureReason };
}

/** 应用一例新案例后的测试覆盖状态 */
function testAfter(bundle: BrainBundle, newType?: ParsedTestCase["type"]) {
  const types = (bundle.testCases ?? []).map((c) => c.type);
  if (newType) types.push(newType);
  const count = types.length;
  const has = (t: string) => types.includes(t);
  return {
    count,
    hasNormal: has("NORMAL"),
    hasBoundary: has("BOUNDARY"),
    hasFailOrNa: has("FAILURE") || has("NA"),
    complete: count >= 5 && has("NORMAL") && has("BOUNDARY") && (has("FAILURE") || has("NA")),
  };
}

/** 把 "4.targetUser" 这样的焦点串解析成合法路由目标(供"到对话中重说"使用) */
export function parseFocus(focus?: string | null): { step: number; key: string } | null {
  if (!focus) return null;
  const m = /^([2-6])\.([A-Za-z]+)$/.exec(focus);
  if (!m) return null;
  const step = Number(m[1]);
  const key = m[2];
  if (step === 3 && key === "track") return { step, key };
  if (step === 2 && ["startTime", "existingBase", "addedDuringActivity", "externalResources", "helpers"].includes(key)) return { step, key };
  if ([4, 5, 6].includes(step) && getStepConfig(step)!.fields.some((f) => f.key === key)) return { step, key };
  return null;
}

/** 各字段的口语化提问模板(比"XX是什么"更自然) */
const ASK: Record<string, string> = {
  agreeRules: "开始之前——活动规则、数据承诺、原创要求这三条底线,你接受吗?(回复\"同意\"即可)",
  targetUser: "先说说谁在遇到这个麻烦?具体是什么人、什么角色?",
  scenario: "他在什么场景下遇到?把最近一次的情形讲给我听。",
  frequency: "这种事多久发生一次?最好是个数过的数字。",
  currentProcess: "他现在是怎么一步步应付的?",
  worstStep: "这套应付里最容易出错/最烦的是哪一步?为什么?",
  currentCost: "每次大概耗多少时间?或者造成什么质量问题?",
  whyWorth: "如果一直没人解决,最坏的后果是什么?",
  usableResult: "做成什么样算\"能用\"?一句话说清合格线。",
  unacceptableErrors: "反过来——什么样的结果是绝对不能接受的?",
  judgmentSource: "对错由谁说了算?你的判定依据放在哪里?",
  inputInfo: "这个解法的输入是什么?(数据/文档/消息…)",
  outputFormat: "输出长什么样?给谁看?",
  stopConditions: "遇到什么情况必须停下来交给人?至少想两个。",
  initialTestCases: "凭直觉列几个你会测的例子,不用完整,念头就行。",
  oneSentenceMvp: "用一句话说清你要做的东西——它把什么变成什么?",
  coreUser: "第一个用户具体是谁?最好就是你自己或隔壁同事。",
  coreProblem: "你只解决他的哪一个问题?",
  coreLoop: "完整走一遍:输入→处理→检查→人工确认→输出,每环一句话。",
  verifiableMetric: "用什么数字判断成功?从多少降到多少?",
  aiResponsibility: "AI负责哪几步?",
  humanResponsibility: "人负责哪几步?",
  autoCheckScope: "机器能自动检查什么?列成清单。",
  humanConfirmPoint: "人在哪个点必须亲自确认?",
  finalOwner: "最后签字负责的人是谁?写名字。",
  tools: "你打算用什么工具/模型?越简单越好。",
  notDoing: "这期明确不做什么?至少列两件。",
  // 团队披露(第2步,存Team,此处仅提示话术)
  startTime: "这个想法实际什么时候开始做的?",
  existingBase: "开始之前你已经有什么基础?(没有就说\"无\")",
  addedDuringActivity: "活动期间你新做了哪些东西?",
  externalResources: "用了哪些开源项目/模板/模型/外部资源?如实列。",
  helpers: "有谁帮过你吗?(没有就\"无\";帮助要写清是什么)",
};

interface EmptyFieldInput {
  stages: { step: number; data: string }[];
  project: { track: string | null };
}

function firstEmptyField(bundle: EmptyFieldInput, team: Record<string, unknown>): { step: number; key: string; label: string } | null {
  // 第1步:承诺
  if (!rulesAgreed(bundle.stages)) return { step: 1, key: "agreeRules", label: "活动承诺" };
  // 第2步:团队披露(存Team)
  const teamKeys = ["startTime", "existingBase", "addedDuringActivity", "externalResources", "helpers"];
  for (const k of teamKeys) {
    const v = team[k];
    if (typeof v !== "string" || !v.trim()) return { step: 2, key: k, label: k };
  }
  // 第3步:赛道
  if (!bundle.project.track) return { step: 3, key: "track", label: "赛道" };
  // 第4-6步:必填字段
  for (const step of [4, 5, 6]) {
    const cfg = getStepConfig(step)!;
    const data = getStageData(bundle.stages, step);
    for (const f of cfg.fields) {
      const v = data[f.key];
      const empty = typeof v !== "string" || !v.trim();
      if (f.required && empty) return { step, key: f.key, label: f.label.split("(")[0].slice(0, 14) };
    }
  }
  return null;
}

const ACCEPT_WORDS = /^(同意|好|好的|OK|ok|确认|我同意|接受|同意。|同意,)/;

/** 纯函数:给定项目状态与用户消息,产出Agent的下一句与结构化更新 */
export function chatTurn(input: {
  bundle: BrainBundle;
  team: Record<string, unknown>;
  lastTarget: { step: number; key: string } | null;
  message: string;
}): ChatTurn {
  const { bundle, team, lastTarget, message } = input;
  const msg = message.trim();

  const updates: ChatTurn["updates"] = [];
  // 1) 承诺(首条即答或按问作答均可)
  const accepting = ACCEPT_WORDS.test(msg);
  if ((lastTarget?.step === 1 || (!lastTarget && accepting)) && accepting && !rulesAgreed(bundle.stages)) {
    updates.push({ step: 1, key: "agreeRules", value: true }, { step: 1, key: "agreeDataSafety", value: true }, { step: 1, key: "agreeOriginality", value: true });
    return { reply: "三条底线确认 ✓ 那我们开始。", updates, nextTarget: firstEmptyFieldAfter(bundle, team, updates), grill: null };
  }

  // 2) 团队披露(step2字段写Team,由调用方处理,这里只出话术)
  if (lastTarget?.step === 2 && lastTarget.key && msg) {
    updates.push({ step: 2, key: lastTarget.key, value: msg.slice(0, 800) });
    return { reply: "已记录 ✓", updates, nextTarget: firstEmptyFieldAfter(bundle, team, updates), grill: null };
  }

  // 3) 赛道
  if (lastTarget?.step === 3 && msg) {
    const track = ["个人效率助手", "知识问答助手", "流程自动化工具", "工程业务Agent"].find((t) => msg.includes(t.slice(0, 2)));
    if (track) {
      updates.push({ step: 3, key: "track", value: track });
      return { reply: `赛道:${track} ✓ (随时可改)`, updates, nextTarget: firstEmptyFieldAfter(bundle, team, updates), grill: null };
    }
    return { reply: "没认出赛道——四个正式赛道:个人效率助手 / 知识问答助手 / 流程自动化工具 / 工程业务Agent,选一个?", updates, nextTarget: { step: 3, key: "track", label: "赛道" }, grill: null };
  }

  // 4) 4-6步字段提取
  if (lastTarget && [4, 5, 6].includes(lastTarget.step) && lastTarget.key && msg) {
    // 轻量语义路由:用户答非所问时,把高频错位拨回正确字段
    let key = lastTarget.key;
    const data4 = getStageData(bundle.stages, 4);
    if (lastTarget.step === 4 && key === "scenario" && /(每周|每天|每月|经常|频繁|\d+\s*次)/.test(msg) && !String(data4.frequency ?? "").trim()) {
      key = "frequency"; // 问场景,答了频率
    }
    updates.push({ step: lastTarget.step, key, value: msg.slice(0, 800) });
    const after = firstEmptyFieldAfter(bundle, team, updates);
    let grill: ChatTurn["grill"] = null;
    // 拷问插入:频率无数字/指标无数字/AI越界
    if (key === "frequency" && !/\d/.test(msg)) {
      grill = { q: "「" + msg.slice(0, 16) + "」是估的还是数过?", why: "估的频率往往差3倍,它决定值不值得做" };
    } else if (key === "verifiableMetric" && !/\d/.test(msg)) {
      grill = { q: "这个指标里没有数字——多少算达标?", why: "没有数字,验证时谁说了算?" };
    } else if (key === "aiResponsibility" && /(决定|放行|验收|最终)/.test(msg)) {
      grill = { q: "你把「" + (msg.match(/(决定|放行|验收|最终)/) ?? ["判断"])[0] + "」交给AI——出错那天算谁的?", why: "责任不可外包,这是红线" };
    }
    const reply = grill ? "先记下 ✓ 不过我得追问——" + grill.q : "已记录 ✓";
    return { reply, updates, nextTarget: after, grill };
  }

  // 4.5) 第8步:口述测试案例(一问一例,AI拆解落表)
  if (lastTarget?.step === 8 && msg) {
    // 上一例预期缺失,用户正在补充
    if (lastTarget.key === "testCaseExpected") {
      updates.push({ step: 8, key: "testCaseExpected", value: msg.slice(0, 200) });
      const st = testAfter(bundle);
      return {
        reply: st.complete ? "预期已补上 ✓ 常规/边界/失败都齐了——去跑提交预检?" : "预期已补上 ✓ 继续讲下一例。",
        updates,
        nextTarget: st.complete ? null : { step: 8, key: "testCase", label: "测试案例" },
        action: st.complete ? "run-precheck" : undefined,
        grill: null,
      };
    }
    const parsed = parseTestCaseStory(msg);
    if (parsed) {
      updates.push({ step: 8, key: "testCase", value: parsed });
      const after = testAfter(bundle, parsed.type);
      if (parsed.expected === EXPECT_PENDING) {
        return {
          reply: `第${after.count}例(${TEST_TYPE_LABELS[parsed.type]})先记下 ✓ 它的预期结果是什么——正常应该出什么?`,
          updates,
          nextTarget: { step: 8, key: "testCaseExpected", label: "上一例预期" },
          grill: null,
        };
      }
      if (after.complete) {
        return {
          reply: `第${after.count}例(${TEST_TYPE_LABELS[parsed.type]})已落表 ✓ 常规/边界/失败都齐了——去跑提交预检?`,
          updates,
          nextTarget: null,
          action: "run-precheck",
          grill: null,
        };
      }
      const missing: string[] = [];
      if (!after.hasNormal) missing.push("常规");
      if (!after.hasBoundary) missing.push("边界/复杂");
      if (!after.hasFailOrNa) missing.push("失败或不适用");
      const need = Math.max(0, 5 - after.count);
      const hint = need > 0 ? `还差${need}例` : `还缺覆盖:${missing.join("/")}`;
      const invite = !after.hasFailOrNa ? "最好讲一个失败或不适用的例子——它什么时候会搞砸?" : missing.length ? `补一例${missing[0]}的:` : "再讲一例:";
      return {
        reply: `第${after.count}例(${TEST_TYPE_LABELS[parsed.type]})已落表 ✓ ${hint} ${invite}`,
        updates,
        nextTarget: { step: 8, key: "testCase", label: "测试案例" },
        grill: null,
      };
    }
    // 讲不出来 → 引导表格(不强迫)
    const st = testAfter(bundle);
    return {
      reply: `没关系——已收集${st.count}例。测试案例也可以直接在第8步的表格里填,填完回来跑预检。`,
      updates,
      nextTarget: null,
      action: "open-structure-8",
      grill: null,
    };
  }

  // 5) 没有明确目标:开启下一个空位
  const next = firstEmptyField(bundle, team);
  if (!next) {
    // 4-6步齐了 → 邀请口述测试(对话内完成,表格随时可改)
    const st = testAfter(bundle);
    if (st.complete) {
      return {
        reply: "材料与测试都齐了。下一步:跑一次提交预检,看看四维预检分数。",
        updates,
        nextTarget: null,
        action: "run-precheck",
        grill: null,
      };
    }
    return {
      reply: `核心材料齐了 ✓ 现在讲测试——想象你真的在用它,讲一个你会试的场景:给它什么输入、期望出什么?(共需5例:常规、边界/复杂、至少1个失败或不适用;不想说就去第8步表格填)`,
      updates,
      nextTarget: { step: 8, key: "testCase", label: "测试案例" },
      grill: null,
    };
  }
  return { reply: ASK[next.key] ?? `说说:${next.label}?`, updates, nextTarget: { step: next.step, key: next.key, label: next.label }, grill: null };
}

/** 应用updates后重新计算下一空位(不改入参) */
function firstEmptyFieldAfter(bundle: BrainBundle, team: Record<string, unknown>, updates: ChatTurn["updates"]): ChatTurn["nextTarget"] {
  const stages = bundle.stages.map((s) => ({ ...s, data: s.data }));
  const applyStage = (step: number, patch: Record<string, unknown>) => {
    const row = stages.find((x) => x.step === step);
    const merged = { ...getStageData(stages, step), ...patch };
    if (row) row.data = JSON.stringify(merged);
    else stages.push({ step, data: JSON.stringify(merged) });
  };
  for (const u of updates) {
    if (u.step === 1) applyStage(1, { agreeRules: true, agreeDataSafety: true, agreeOriginality: true });
    else if (u.step >= 4 && u.step <= 6 && typeof u.value === "string") applyStage(u.step, { [u.key]: u.value });
  }
  const teamNext = { ...team };
  for (const u of updates) if (u.step === 2) teamNext[u.key] = u.value;
  const track = updates.find((u) => u.step === 3)?.value;
  return firstEmptyField({ stages, project: { track: typeof track === "string" ? track : bundle.project.track } }, teamNext);
}

export const CHAT_OPENING = `致参赛者:

我不打算给你一张表格。你只需要把这件事讲清楚——谁、在哪儿、多久一次、怎么应付、哪里最烦。我一边听一边帮你把材料整理成评审要看的样子,该追问的地方我会追问。

准备好了就说第一句。`;

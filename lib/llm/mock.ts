// Mock Provider:无 API Key 时的确定性启发式诊断引擎,保证结构化输出始终合法,
// 用于开发与完整演示。不调用任何外部服务。

import type { LLMProvider, ChatJSONParams, ChatJSONResult } from "./provider";
import type { ProjectBundle } from "../projects";
import type { AgentFeedback } from "./schema";
import { getStageData, closedLoopMissing, rulesAgreed, validateStageData, validateTestCases } from "../validation";
import { getStepConfig, STEPS } from "../steps";
import { TRACKS } from "../constants";
import type { RiskFlagSchema } from "./schema";
import type { z } from "zod";

type RiskFlag = z.infer<typeof RiskFlagSchema>;

export interface MockContext {
  bundle: ProjectBundle;
  step: number;
  purpose: "COACH" | "PRECHECK";
  /** 此前的问答(用于追问演进,不重复问) */
  answers?: { q: string; a: string }[];
}

/** 拷问题库:针对用户已写内容找漏洞,每题附 why(教育意义) */
function grillQuestions(ctx: MockContext): { q: string; why: string }[] {
  const { bundle, step } = ctx;
  const out: { q: string; why: string }[] = [];
  const push = (q: string, why: string) => {
    if (out.length < 3) out.push({ q, why });
  };
  const s4 = getStageData(bundle.stages, 4);
  const s5 = getStageData(bundle.stages, 5);
  const s6 = getStageData(bundle.stages, 6);
  const str = (d: Record<string, unknown>, k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  const hasDigit = (s: string) => /\d/.test(s);

  // 追问演进:有回答就深挖一层,不重复上一问
  if (ctx.answers && ctx.answers.length > 0) {
    const last = ctx.answers[ctx.answers.length - 1];
    push(
      `你上次回答「${last.a.slice(0, 26)}${last.a.length > 26 ? "…" : ""}」——如果数据源换了、频率变了,这个答案还成立吗?`,
      "好的判断要经得起条件变化,而不是背一个答案"
    );
  }

  if (step === 4) {
    if (str(s4, "frequency") && !hasDigit(str(s4, "frequency"))) {
      push(`你说「${str(s4, "frequency").slice(0, 18)}」——这是估的,还是真的数过一次?`, "频率决定这件事值不值得做,估的数字往往差3倍");
    }
    if (/所有人|大家|每个人都|全公司|全部门/.test(str(s4, "targetUser"))) {
      push(`「${str(s4, "targetUser").slice(0, 14)}」——能落到一个具体的人吗?他叫什么、坐哪?`, "用户越具体,判定标准越好写");
    }
    if (str(s4, "worstStep") && str(s4, "worstStep").length < 12) {
      push("最麻烦的那一步,你上一次出错是什么时候?当时具体错在哪?", "错误细节是判定标准的最好原料");
    }
  } else if (step === 5) {
    const js = str(s5, "judgmentSource");
    if (js && !/(为准|对照|标准|清单|口径)/.test(js)) {
      push(`「${js.slice(0, 18)}」——如果两份依据打架,谁赢?`, "判定标准必须能裁决冲突,否则等于没有");
    }
    if (str(s5, "stopConditions") && !/[、,;,,]/.test(str(s5, "stopConditions"))) {
      push("只写了一个停止条件?想一个最离谱的输入,它靠什么被拦住?", "异常路径想得越全,人工确认点越可靠");
    }
  } else if (step === 6) {
    const ai = str(s6, "aiResponsibility");
    if (/(决定|判断|放行|验收|最终)/.test(ai)) {
      push(`你把「${(ai.match(/(决定|判断|放行|验收|最终)/) ?? ["判断"])[0]}」交给了AI——它出错的那天,算谁的?`, "责任不可外包,这是活动红线也是工程常识");
    }
    if (str(s6, "verifiableMetric") && !hasDigit(str(s6, "verifiableMetric"))) {
      push(`「${str(s6, "verifiableMetric").slice(0, 16)}」里没有数字——多少算达标?`, "没有数字的指标,验证时谁说了算?");
    }
  } else if (step === 8) {
    const f = bundle.testCases.find((t) => (t.verdict === "FAIL" || t.type === "FAILURE") && !t.failureReason);
    if (f) {
      push(`失败案例「${f.name.slice(0, 12)}」为什么会失败?一行话说清根因`, "失败原因写清了,它才从事故变成证据");
    }
  }

  // 兜底:总有得问
  if (out.length === 0) {
    push("如果明天就要给一个陌生同事演示,你敢删掉哪一半功能?为什么留下另一半?", "砍到不能再砍,才知道什么是核心");
  }
  return out;
}

const has = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

function collectAllText(bundle: ProjectBundle): string {
  const parts: string[] = [];
  for (const s of bundle.stages) {
    try {
      const d = JSON.parse(s.data) as Record<string, unknown>;
      for (const v of Object.values(d)) if (typeof v === "string") parts.push(v);
    } catch {
      /* ignore */
    }
  }
  for (const t of bundle.testCases) parts.push([t.name, t.input, t.expected, t.actual, t.failureReason].join(" "));
  parts.push(bundle.team.existingBase || "", bundle.team.externalResources || "");
  return parts.join("\n");
}

function detectRisks(ctx: MockContext): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const text = collectAllText(ctx.bundle);
  const s6 = getStageData(ctx.bundle.stages, 6);

  if (/平台|生态|多[个名]?agent|多agent|所有部门|全公司|全部业务|一套系统/.test(text)) {
    risks.push({
      type: "scope_too_large",
      severity: "medium",
      message: "描述中出现平台化/全公司级表述。MVP应先服务一个核心用户的一个核心闭环,建议收窄范围。",
    });
  }
  if (/生产环境|生产系统|直连|线上库|正式库/.test(text)) {
    risks.push({
      type: "production_integration",
      severity: "high",
      message: "疑似计划接入生产环境。活动红线:原型不得直接接入生产系统,请使用模拟数据或脱敏样例。",
    });
  }
  if (/(密码|密钥|账号|token|apikey)\s*[::=]/i.test(text) || /\bsk-[A-Za-z0-9]{12,}/.test(text)) {
    risks.push({
      type: "sensitive_data",
      severity: "high",
      message: "文本中疑似包含账号、密钥或令牌。请立即替换为脱敏样例。",
    });
  }
  if (!has(s6.finalOwner) || /AI(最终|负责)(放行|决定|验收|质量判断)/.test(text)) {
    if (!has(s6.finalOwner)) {
      risks.push({
        type: "engineering_judgement",
        severity: "medium",
        message: "未写明最终责任人。关键工程判断与质量放行不能全部交给AI,需指定1—2名参赛者负责。",
      });
    }
  }
  if (/(已上线|去年|去年已完成|成熟项目|现成成果)/.test(bundleExisting(ctx.bundle))) {
    risks.push({
      type: "existing_project",
      severity: "medium",
      message: "已有基础描述疑似指向成熟项目。直接提交活动前成熟成果不能进入正常评奖,请明确活动期间新增部分。",
    });
  }
  const missingLoop = closedLoopMissing(ctx.bundle.stages);
  if (missingLoop.length > 0) {
    risks.push({
      type: "no_verification",
      severity: "high",
      message: `求证闭环缺少:${missingLoop.map((f) => f.label).join("、")}。没有明确检查环节的闭环,验证维度预检为0并无法提交。`,
    });
  }
  if (ctx.bundle.team.memberCount > 2) {
    risks.push({ type: "team_size", severity: "high", message: `队伍${ctx.bundle.team.memberCount}人,超出1—2人上限。` });
  }
  return risks;
}

function bundleExisting(b: ProjectBundle): string {
  return `${b.team.existingBase || ""} ${b.team.addedDuringActivity || ""}`;
}

/** 某一步的空缺必填字段 */
function missingFields(bundle: ProjectBundle, step: number): { key: string; label: string }[] {
  const cfg = getStepConfig(step);
  if (!cfg) return [];
  const data = getStageData(bundle.stages, step);
  return cfg.fields
    .filter((f) => {
      if (f.type === "checkbox") return data[f.key] !== true;
      return !has(data[f.key]);
    })
    .map((f) => ({ key: f.key, label: f.label.split("(")[0].slice(0, 12) }));
}

function fillRatio(bundle: ProjectBundle, step: number): number {
  const cfg = getStepConfig(step);
  if (!cfg || cfg.fields.length === 0) return 1;
  const missing = missingFields(bundle, step).length;
  return 1 - missing / cfg.fields.length;
}

function score10(ratio: number): number {
  return Math.round(ratio * 10);
}

export function generateMockFeedback(ctx: MockContext): AgentFeedback {
  const { bundle, step, purpose } = ctx;
  const risks = detectRisks(ctx);

  // ---------- 预检模式:四维40分 ----------
  if (purpose === "PRECHECK") {
    const missingLoop = closedLoopMissing(bundle.stages);
    const problem = score10(fillRatio(bundle, 4));
    const disclosureFields = ["startTime", "existingBase", "addedDuringActivity", "externalResources", "helpers"];
    const disclosureDone = disclosureFields.filter((k) => has((bundle.team as unknown as Record<string, unknown>)[k])).length;
    const originality = Math.round((disclosureDone / disclosureFields.length) * 8) + (has(bundle.team.helpers) ? 2 : 0);
    const closedLoopScore = missingLoop.length === 0 ? Math.min(10, 6 + (has(getStageData(bundle.stages, 6).autoCheckScope) ? 2 : 0) + (has(getStageData(bundle.stages, 6).finalOwner) ? 2 : 0)) : 0;
    const tests = bundle.testCases;
    const coverage = validateTestCases(tests);
    const passCount = tests.filter((t) => t.verdict === "PASS").length;
    const documentedFailures = tests.filter((t) => (t.verdict === "FAIL" || t.type === "FAILURE") && has(t.failureReason)).length;
    const evidence = coverage.errors.length === 0 ? Math.min(10, 4 + Math.min(4, passCount) + Math.min(2, documentedFailures)) : Math.min(4, tests.length);
    const scores = {
      problem_definition: problem,
      originality,
      closed_loop: closedLoopScore,
      evidence,
      total: problem + originality + closedLoopScore + evidence,
      note: "仅供完善材料参考,不代表正式评审结果。",
    };
    const gaps: { field: string; reason: string }[] = [];
    for (const m of missingFields(bundle, 4).slice(0, 3)) gaps.push({ field: m.key, reason: `第4步「${m.label}」未填写` });
    if (missingLoop.length) gaps.push({ field: "closed_loop", reason: `求证闭环缺少${missingLoop.map((f) => f.label).join("、")}` });
    if (coverage.errors.length) gaps.push({ field: "tests", reason: coverage.errors[0].reason });
    return {
      stage_assessment: risks.some((r) => r.severity === "high") ? "blocked" : gaps.length ? "needs_revision" : "ready",
      summary:
        gaps.length === 0
          ? "预检通过:材料结构完整,建议再核对测试证据与Demo脚本后提交。"
          : `预检发现${gaps.length}处待完善,先补齐最关键的缺口。`,
      critical_gaps: gaps.slice(0, 5),
      questions: [
        tests.some((t) => t.verdict === "PENDING")
          ? "还有待判定的测试案例,实际结果与判定补齐了吗?"
          : "失败案例的失败原因和人工修改写清楚了吗?",
      ].slice(0, 1),
      suggestions: buildPrecheckSuggestions(ctx),
      risk_flags: risks,
      next_action: gaps[0]?.reason ? `先完成:${gaps[0].reason}` : "运行硬规则校验并提交,然后生成90秒Demo脚本。",
      can_continue: true,
      precheck_scores: scores,
    };
  }

  // ---------- 辅导模式:按当前步骤 ----------
  const cfg = getStepConfig(step);
  const stepTitle = cfg?.title ?? `第${step}步`;
  const data = getStageData(bundle.stages, step);
  const missing = missingFields(bundle, step);
  const highRisk = risks.filter((r) => r.severity === "high");

  let assessment: AgentFeedback["stage_assessment"] = "needs_revision";
  if (highRisk.length > 0) assessment = "blocked";
  else if (missing.length === 0 && step >= 4) assessment = "ready";
  else if (step < 4) assessment = missing.length ? "needs_revision" : "ready";

  const gaps = missing.slice(0, 4).map((m) => ({ field: m.key, reason: `「${m.label}」还是空的` }));
  const { suggestions, next_action, summary } = stepCoach(ctx, missing.length === 0);
  const grill = grillQuestions(ctx);

  return {
    stage_assessment: assessment,
    summary,
    critical_gaps: gaps,
    questions: grill,
    suggestions,
    risk_flags: risks,
    next_action,
    can_continue: assessment !== "blocked",
    precheck_scores: null,
  };
}

function buildPrecheckSuggestions(ctx: MockContext): { title: string; action: string; why: string }[] {
  const b = ctx.bundle;
  const out: { title: string; action: string; why: string }[] = [];
  const loopMissing = closedLoopMissing(b.stages);
  if (loopMissing.length) {
    out.push({
      title: "补齐求证闭环五要素",
      action: `在第5步与第6步补写:${loopMissing.map((f) => f.label).join("、")}`,
      why: "没有明确检查环节的闭环是活动红线,验证维度为0且无法提交。",
    });
  }
  const coverage = validateTestCases(b.testCases);
  if (coverage.errors.length) {
    out.push({
      title: "补足测试案例",
      action: coverage.errors[0].reason + ";记得至少1例失败或不适用,并写清失败原因",
      why: "5例测试是硬性要求,失败案例是重要的验证证据。",
    });
  }
  const pending = b.testCases.filter((t) => t.verdict === "PENDING").length;
  if (pending > 0) {
    out.push({
      title: `完成${pending}例待判定的判定`,
      action: "把实际结果、判定与人工修改补齐;失败就如实记录失败原因",
      why: "判定完整的测试证据才能支撑验证维度得分。",
    });
  }
  if (out.length === 0) {
    out.push({
      title: "生成三件套并自查",
      action: "打开小实验卡与90秒Demo脚本预览,按打印版自查一遍再提交",
      why: "交付物是评审第一入口,结构完整能减少退回补充。",
    });
  }
  return out.slice(0, 3);
}

function stepCoach(ctx: MockContext, complete: boolean): {
  questions: string[];
  suggestions: { title: string; action: string; why: string }[];
  next_action: string;
  summary: string;
} {
  const b = ctx.bundle;
  const step = ctx.step;
  const data = getStageData(b.stages, step);
  const text = collectAllText(b);

  const S = (title: string, action: string, why: string) => ({ title, action, why });

  switch (step) {
    case 1:
      return {
        summary: complete ? "规则与承诺已确认,可以进入组队。" : "请先勾选三项承诺,理解规则再动手。",
        questions: ["四项交付节奏(小实验卡、可见结果、90秒成果包)你计划怎么安排?"],
        suggestions: [S("先读一遍红线", "重点看求证闭环与数据安全两条红线", "这两条是硬性门槛,后期返工代价最大")],
        next_action: complete ? "进入第2步:创建队伍或邀请搭档。" : "勾选第1步的三项合规承诺。",
      };
    case 2: {
      const disclosureMissing = ["startTime", "existingBase", "addedDuringActivity", "externalResources", "helpers"].filter(
        (k) => !has((b.team as unknown as Record<string, unknown>)[k])
      );
      return {
        summary:
          disclosureMissing.length === 0 && b.team.memberCount >= 1
            ? `队伍${b.team.memberCount}人,披露完整。`
            : `组队信息还差${disclosureMissing.length + (b.team.memberCount === 0 ? 1 : 0)}项。`,
        questions:
          b.team.memberCount === 1
            ? ["你一个人同时覆盖Echo(问题)和Delta(构建)两种视角吗?每周大概能投入几小时?"]
            : ["两人如何分工Echo与Delta?判定标准由谁最终把关?"],
        suggestions: [
          ...(disclosureMissing.length
            ? [S("补齐原创披露", `填写:${disclosureMissing.join("、")}`, "如实披露是评奖资格的前提,活动前已有基础必须写明")]
            : []),
          ...(b.team.memberCount === 2
            ? [S("明确双人分工", "一人主问题与判定标准(Echo),一人主工具与测试(Delta)", "互补分工能同时保证需求深度与交付速度")]
            : []),
        ].slice(0, 3),
        next_action: disclosureMissing.length ? `先填写「${disclosureMissing[0]}」` : "进入第3步选择赛道。",
      };
    }
    case 3: {
      const t = b.project.track;
      const trackName = TRACKS.find((x) => x.key === t)?.name;
      const hinted = /问答|知识|FAQ/.test(text) ? "knowledge-qa" : /流程|表单|搬运|核对|批量/.test(text) ? "process-automation" : /效率|周报|纪要|摘要/.test(text) ? "personal-efficiency" : /日志|工单|评审|代码/.test(text) ? "engineering-agent" : null;
      return {
        summary: t ? `已选「${trackName}」。` : "还未选择赛道。",
        questions: [t ? `为什么这个赛道最适合你的问题?` : "你的问题更偏个人琐事、知识问答、规则明确的流程,还是工程环节辅助?"],
        suggestions: [
          ...(t
            ? [S("对照赛道边界", "检查\"不适合做什么\"一栏,确认没有踩线", "赛道错配会在评审时损失真问题维度得分")]
            : hinted
              ? [S("参考匹配建议", `根据你的描述,可考虑「${TRACKS.find((x) => x.key === hinted)?.name}」,最终由你决定`, "匹配的赛道让评审更容易理解你的问题场景")]
              : [S("先完成第4步再定赛道", "把真问题描述清楚后回来选,更不容易选错", "赛道是问题的分类,不是先决条件")]),
        ].slice(0, 3),
        next_action: t ? "进入第4步:描述真问题。" : "在四个赛道卡片中选择一个(之后可改)。",
      };
    }
    case 4: {
      const d = data as Record<string, unknown>;
      if (!has(d.targetUser) || !has(d.scenario)) {
        return {
          summary: "真问题描述还不完整,先写清谁、在什么场景、多频繁。",
          questions: ["这个麻烦最后一次发生在什么时候?当时你具体做了哪几步?"],
          suggestions: [
            S("从一次真实经历写起", "先口述最近一次的完整经过,再压缩成场景描述", "有具体时间和动作的问题才像真问题"),
            S("量化频率与成本", "频率写\"每周X次\",成本写\"每次约Y分钟\"", "数字能检验问题是否值得解决"),
          ],
          next_action: "填写「目标用户」和「使用场景」各一句话。",
        };
      }
      return {
        summary: complete ? "问题要素齐全,注意保持聚焦,不要扩大范围。" : "还差几个字段,补齐后进入判定标准。",
        questions: [/所有人|大家|每个/.test(String(d.targetUser)) ? "能不能把用户收窄到具体一类人?" : "最麻烦的一步为什么容易出错?"],
        suggestions: [
          S("收窄目标用户", "把\"所有人\"改成具体角色,如\"新入职的结构设计工程师\"", "越具体越容易设计判定标准"),
          S("确认是高频或高价值", "对照频率与成本,判断是否值得做MVP", "低频低价值的问题不适合本次轻创"),
        ],
        next_action: complete ? "进入第5步:需求挖掘与判定标准。" : "补齐第4步剩余必填字段。",
      };
    }
    case 5: {
      const d = data as Record<string, unknown>;
      if (!has(d.judgmentSource) || !has(d.stopConditions)) {
        return {
          summary: "判定标准是求证闭环的地基,缺了它后面无法提交。",
          questions: ["检查时你依据什么说\"这条对了\"?依据放在哪里?"],
          suggestions: [
            S("写出判断依据", "例如\"以系统导出原始记录为准\"", "没有明确依据的检查等于没有检查"),
            S("列出停止条件", "写下2—3种必须停下来交给人的异常", "异常处理是人工责任的体现"),
          ],
          next_action: "填写「判断依据来自哪里」与「异常停止条件」。",
        };
      }
      return {
        summary: complete ? "判定标准已具备雏形,保持可执行、可判定。" : "补齐第5步剩余字段,别急着自动化。",
        questions: ["\"可用\"的标准能不能用一句话判定,而不用主观感觉?"],
        suggestions: [
          S("让标准可判定", "把\"效果不错\"改成\"人工10分钟内可确认发出\"", "可判定的标准才能写成自动检查"),
          S("准备初步案例", "把第8步要用的3个案例先在脑子里过一遍", "判定标准会被案例检验"),
        ],
        next_action: complete ? "进入第6步:MVP与人机边界。" : "补齐第5步剩余必填字段。",
      };
    }
    case 6: {
      const d = data as Record<string, unknown>;
      const loopMissing = closedLoopMissing(b.stages);
      if (loopMissing.length) {
        return {
          summary: "人机边界还没画清,这是活动的红线维度。",
          questions: ["AI输出之后、最终发出之前,谁在哪个点确认?依据什么确认?"],
          suggestions: [
            S("补齐五要素", `还需填写:${loopMissing.map((f) => f.label).join("、")}`, "输入→处理→检查→人工确认→输出,缺一环验证维度为0"),
            S("砍掉多余功能", "只保留一个核心闭环,其他写进\"本期不做\"", "MVP越小越快跑通,平台化是常见失败原因"),
          ],
          next_action: `填写「${loopMissing[0].label}」。`,
        };
      }
      return {
        summary: complete ? "边界清晰,工具链从简。" : "补齐第6步剩余字段。",
        questions: [/向量数据库|微服务|消息队列/.test(text) ? "这些基础设施对当前闭环真的必要吗?" : "工具链里哪一步最不稳定?有没有替代方案?"],
        suggestions: [
          S("用最简单工具链", "优先脚本+现有软件+一个模型API", "简单链路更容易在活动期内跑通并测试"),
          S("写清\"不做\"清单", "至少列3件明确不做的", "明确的边界保护你的时间"),
        ],
        next_action: complete ? "进入第7步:获取Agent综合诊断。" : "补齐第6步剩余必填字段。",
      };
    }
    case 7:
      return {
        summary: complete ? "诊断已生成,逐条处理建议后进入测试。" : "建议先完成前六步的必填项,诊断才有依据。",
        questions: ["哪条建议你现在就能做?哪条先记为已处理?"],
        suggestions: [
          S("逐条处理建议", "能做的标记\"已处理\",不同意的\"忽略\"并写下你的理由(心里)", "Agent建议仅供参考,决策在你"),
          S("处理高危风险", "优先处理红色高风险标记", "高风险直接影响能否提交"),
        ],
        next_action: "处理完建议后进入第8步:填写5个测试案例。",
      };
    case 8: {
      const tests = b.testCases;
      const coverage = validateTestCases(tests);
      if (coverage.errors.length) {
        return {
          summary: `当前${tests.length}例,${coverage.errors[0].reason}。`,
          questions: ["哪个输入会让你的解法出错或必须拒绝处理?"],
          suggestions: [
            S("补覆盖缺口", coverage.errors.find((e) => e.field === "type")?.reason ?? "补足到5例", "三类覆盖是硬性校验"),
            S("设计一个失败案例", "想一个必须停下交给人的输入,并如实记录", "失败案例展示求证边界,是加分项不是减分项"),
          ],
          next_action: coverage.errors[0].reason,
        };
      }
      return {
        summary: `${tests.length}例测试覆盖完整,把判定补齐。`,
        questions: ["每例的\"实际\"都是从真实运行贴过来的吗?"],
        suggestions: [
          S("补齐判定与实际", "每例填实际结果并判定;失败就写失败原因", "输入/预期/实际/判定四件套才是证据"),
          S("记录人工修改", "判定失败后你改了什么,写进\"人工修改\"", "展示异常处理能力"),
        ],
        next_action: "进入第9步:运行提交预检。",
      };
    }
    case 9:
      return {
        summary: "运行硬规则校验与四维预检,红色阻塞项必须解除。",
        questions: ["预检里哪个红项离你最近?"],
        suggestions: [
          S("先解除阻塞", "按\"如何解除\"提示逐条处理", "硬条件不满足无法提交"),
          S("生成三件套", "预览小实验卡与Demo脚本,打印自查", "交付质量决定评审第一印象"),
        ],
        next_action: "点击\"运行提交预检\"。",
      };
    case 10:
      return {
        summary: `当前状态:${b.project.status}。`,
        questions: ["如果被退回补充,你最可能需要补哪部分?"],
        suggestions: [S("保存提交凭据", "下载小实验卡与Demo脚本留存", "退回与评审都以提交快照为准")],
        next_action: "等待组织者处理,或继续打磨材料。",
      };
    default:
      return {
        summary: `第${step}步`,
        questions: [],
        suggestions: [],
        next_action: "继续填写当前步骤。",
      };
  }
}

export class MockProvider implements LLMProvider {
  readonly name = "mock";
  readonly model = "mock-heuristic-v1";

  async chatJSON(params: ChatJSONParams): Promise<ChatJSONResult> {
    // Mock 场景下 context 通过 user 消息的 JSON 传入
    let ctx: MockContext | null = null;
    try {
      const parsed = JSON.parse(params.user) as { mockContext?: MockContext };
      if (parsed?.mockContext) ctx = parsed.mockContext;
    } catch {
      /* ignore */
    }
    const text = ctx
      ? JSON.stringify(generateMockFeedback(ctx))
      : JSON.stringify({
          stage_assessment: "needs_revision",
          summary: "Mock Provider:未提供诊断上下文。",
          critical_gaps: [],
          questions: [],
          suggestions: [],
          risk_flags: [],
          next_action: "请从项目页发起诊断。",
          can_continue: true,
          precheck_scores: null,
        });
    return {
      text,
      promptTokens: Math.ceil((params.system.length + params.user.length) / 4),
      completionTokens: Math.ceil(text.length / 4),
      provider: this.name,
      model: this.model,
    };
  }
}

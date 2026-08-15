// 提交预检:硬规则校验(纯函数)。硬条件不满足时阻止提交,并告知如何解除阻塞。

import {
  closedLoopMissing,
  collectProjectText,
  judgmentSourceVague,
  rulesAgreed,
  scanSensitiveText,
  validateStageData,
  validateTeamDisclosure,
  validateTestCases,
  isValidTrack,
  type TestCaseInput,
} from "./validation";

export interface HardRule {
  code: string;
  label: string;
  passed: boolean;
  message: string;
  fix: string;
}

export interface PrecheckInput {
  team: {
    memberCount: number;
    startTime?: string | null;
    existingBase?: string | null;
    addedDuringActivity?: string | null;
    externalResources?: string | null;
    helpers?: string | null;
  };
  stages: { step: number; data: string }[];
  track?: string | null;
  testCases: TestCaseInput[];
}

export interface PrecheckResult {
  rules: HardRule[];
  canSubmit: boolean;
  blocking: HardRule[];
}

function stepErrors(input: PrecheckInput, step: number): string[] {
  const row = input.stages.find((s) => s.step === step);
  const data = row ? (JSON.parse(row.data || "{}") as Record<string, unknown>) : {};
  return validateStageData(step, data).map((e) => e.reason);
}

export function runHardRules(input: PrecheckInput): PrecheckResult {
  const rules: HardRule[] = [];

  // 1. 合规勾选
  const agreed = rulesAgreed(input.stages);
  rules.push({
    code: "RULE_COMPLIANCE",
    label: "规则与数据承诺已勾选",
    passed: agreed,
    message: agreed ? "已确认" : "第1步的三项合规承诺未全部勾选",
    fix: "回到第1步,勾选活动规则、数据承诺与原创承诺",
  });

  // 2. 组队 1—2 人
  const mc = input.team.memberCount;
  rules.push({
    code: "RULE_TEAM",
    label: "队伍为1—2人",
    passed: mc >= 1 && mc <= 2,
    message: mc >= 1 && mc <= 2 ? `当前${mc}人` : `当前${mc}人,不符合1—2人规则`,
    fix: "在第2步调整队伍规模;每队最多2名核心成员",
  });

  // 3. 已选赛道
  rules.push({
    code: "RULE_TRACK",
    label: "已选择赛道",
    passed: isValidTrack(input.track),
    message: isValidTrack(input.track) ? "已选择" : "未选择赛道",
    fix: "在第3步四个正式赛道中选择一个",
  });

  // 4. 原创披露
  const disclosureErrors = validateTeamDisclosure(input.team);
  rules.push({
    code: "RULE_ORIGINALITY",
    label: "原创声明与外部资源披露完整",
    passed: disclosureErrors.length === 0,
    message: disclosureErrors.length === 0 ? "披露完整" : disclosureErrors.map((e) => e.reason).join(";"),
    fix: "在第2步补齐开始时间、已有基础、活动期间新增内容、外部资源与帮助人员",
  });

  // 5—7. 第4/5/6步必填
  for (const step of [4, 5, 6]) {
    const errs = stepErrors(input, step);
    rules.push({
      code: `RULE_STEP${step}`,
      label: `第${step}步必填项完整`,
      passed: errs.length === 0,
      message: errs.length === 0 ? "已完整" : errs.join(";"),
      fix: `回到第${step}步补齐必填字段`,
    });
  }

  // 8. 测试案例
  const testResult = validateTestCases(input.testCases);
  rules.push({
    code: "RULE_TESTS",
    label: "至少5个测试案例且类型覆盖完整",
    passed: testResult.errors.length === 0,
    message: testResult.errors.length === 0 ? `${input.testCases.length}例,覆盖完整` : testResult.errors.map((e) => e.reason).join(";"),
    fix: "在第8步补足案例数量并覆盖常规、边界或复杂、失败或不适用三类",
  });

  // 9. 求证闭环红线(五要素 + 判定依据是否明确)
  const missingLoop = closedLoopMissing(input.stages);
  const vagueJudgment = judgmentSourceVague(input.stages);
  rules.push({
    code: "RULE_CLOSED_LOOP",
    label: "求证闭环五要素齐备",
    passed: missingLoop.length === 0 && !vagueJudgment,
    message:
      vagueJudgment
        ? "判断依据声称由另一个AI负责质检,但没有明确判定标准,仍视为没有求证闭环"
        : missingLoop.length === 0
          ? "判断依据、自动检查范围、人工确认点、异常停止条件、最终责任人已齐备"
          : `缺少:${missingLoop.map((f) => f.label).join("、")}`,
    fix: vagueJudgment
      ? "把判断依据写成可执行的标准(如\"以XX导出原始记录为准\"或固定字段对照表),AI只能辅助检查,判定标准必须明确且独立于AI"
      : "在第5步补判断依据与异常停止条件,在第6步补自动检查范围、人工确认点与最终责任人;没有检查环节的闭环不能提交",
  });

  // 10. 敏感信息红线
  const hits = scanSensitiveText(collectProjectText({ stages: input.stages, testCases: input.testCases, team: input.team as Record<string, unknown> }));
  rules.push({
    code: "RULE_SENSITIVE",
    label: "未发现敏感信息",
    passed: hits.length === 0,
    message: hits.length === 0 ? "未检出" : `检出:${[...new Set(hits)].join("、")}`,
    fix: "改用已脱敏样例或模拟数据;不得展示账号、密钥、内部地址或个人敏感信息",
  });

  const blocking = rules.filter((r) => !r.passed);
  return { rules, canSubmit: blocking.length === 0, blocking };
}

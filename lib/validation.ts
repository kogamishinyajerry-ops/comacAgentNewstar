// 领域校验:阶段数据、求证闭环红线、测试覆盖、敏感信息扫描(纯函数,供 API 与测试复用)

import { RULE_CHECKBOX_KEYS, TEAM_FIELDS, getStepConfig, type StepField } from "./steps";
import { TEST_TYPES, TRACK_KEYS } from "./constants";

export interface FieldError {
  field: string;
  reason: string;
}

export type StageData = Record<string, unknown>;

export function getField(config: StepField[], key: string): StepField | undefined {
  return config.find((f) => f.key === key);
}

export function validateStageData(step: number, data: StageData): FieldError[] {
  const config = getStepConfig(step);
  if (!config) return [{ field: "step", reason: `未知步骤:${step}` }];
  const errors: FieldError[] = [];
  for (const f of config.fields) {
    const value = data[f.key];
    if (f.type === "checkbox") {
      if (f.required && value !== true) {
        errors.push({ field: f.key, reason: "该承诺必须勾选后才能继续" });
      }
      continue;
    }
    if (f.type === "select" && value !== undefined && value !== "") {
      if (!f.options?.some((o) => o.value === value)) {
        errors.push({ field: f.key, reason: "选项无效" });
      }
      continue;
    }
    const str = typeof value === "string" ? value.trim() : value == null ? "" : String(value);
    if (f.required && !str) {
      errors.push({ field: f.key, reason: `${f.label}为必填项,请填写后再继续` });
    }
  }
  return errors;
}

// ---------- 求证闭环红线 ----------
// 最小闭环:输入 → AI或自动化处理 → 依据明确标准检查 → 人工确认或异常处理 → 输出
export const CLOSED_LOOP_FIELDS: { key: string; label: string; step: number }[] = [
  { key: "judgmentSource", label: "判断依据", step: 5 },
  { key: "stopConditions", label: "异常停止条件", step: 5 },
  { key: "autoCheckScope", label: "自动检查范围", step: 6 },
  { key: "humanConfirmPoint", label: "人工确认点", step: 6 },
  { key: "finalOwner", label: "最终责任人", step: 6 },
];

export function getStageData(stages: { step: number; data: string }[], step: number): StageData {
  const row = stages.find((s) => s.step === step);
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.data);
    return typeof parsed === "object" && parsed !== null ? (parsed as StageData) : {};
  } catch {
    return {};
  }
}

export function closedLoopMissing(stages: { step: number; data: string }[]): typeof CLOSED_LOOP_FIELDS {
  return CLOSED_LOOP_FIELDS.filter((f) => {
    const data = getStageData(stages, f.step);
    const v = data[f.key];
    return typeof v !== "string" || !v.trim();
  });
}

export function closedLoopComplete(stages: { step: number; data: string }[]): boolean {
  return closedLoopMissing(stages).length === 0;
}

// 声称由另一个AI负责质检,但写不出明确判定标准,仍视为没有求证闭环
const AI_JUDGE_RE = /(由(另一个|另个)?(AI|智能体|大模型|机器人))|((AI|智能体|大模型|机器人)\s*(负责)?\s*(质检|判断|审核|复核|检查))/i;
const CONCRETE_STANDARD_RE = /(以|按照|根据|对照).{0,30}(为准|对照|标准|清单|规则|口径)|字段对照表|检查清单|判定标准/;

export function judgmentSourceVague(stages: { step: number; data: string }[]): boolean {
  const data = getStageData(stages, 5);
  const v = typeof data.judgmentSource === "string" ? data.judgmentSource.trim() : "";
  if (!v) return false; // 空缺由 closedLoopMissing 覆盖
  return AI_JUDGE_RE.test(v) && !CONCRETE_STANDARD_RE.test(v);
}

// ---------- 原创披露 ----------
export function validateTeamDisclosure(team: {
  startTime?: string | null;
  existingBase?: string | null;
  addedDuringActivity?: string | null;
  externalResources?: string | null;
  helpers?: string | null;
}): FieldError[] {
  const errors: FieldError[] = [];
  for (const f of TEAM_FIELDS) {
    const v = (team as Record<string, unknown>)[f.key];
    if (typeof v !== "string" || !v.trim()) {
      errors.push({ field: f.key, reason: `原创披露必填:${f.label}` });
    }
  }
  return errors;
}

// ---------- 测试案例 ----------
export interface TestCaseInput {
  name: string;
  type: string;
  input: string;
  expected: string;
  actual?: string;
  verdict?: string;
  manualFix?: string;
  failureReason?: string;
}

export interface TestCoverageResult {
  errors: FieldError[];
  countOk: boolean;
  coverageOk: boolean;
}

export function validateTestCases(tests: TestCaseInput[]): TestCoverageResult {
  const errors: FieldError[] = [];
  if (tests.length < 5) {
    errors.push({
      field: "count",
      reason: `至少需要5个测试案例,当前${tests.length}个`,
    });
  }
  const typeCount = (t: string) => tests.filter((x) => x.type === t).length;
  if (typeCount("NORMAL") < 1) {
    errors.push({ field: "type", reason: "缺少常规情况案例,至少1个" });
  }
  if (typeCount("BOUNDARY") < 1) {
    errors.push({ field: "type", reason: "缺少边界或复杂情况案例,至少1个" });
  }
  if (typeCount("FAILURE") + typeCount("NA") < 1) {
    errors.push({ field: "type", reason: "缺少失败或不适用情况案例,至少1个" });
  }
  tests.forEach((t, i) => {
    const label = t.name?.trim() || `第${i + 1}例`;
    if (!t.name?.trim()) errors.push({ field: `tests.${i}.name`, reason: `第${i + 1}例缺少案例名称` });
    if (!t.input?.trim()) errors.push({ field: `tests.${i}.input`, reason: `${label}:缺少输入` });
    if (!t.expected?.trim()) errors.push({ field: `tests.${i}.expected`, reason: `${label}:缺少预期` });
    if (!TEST_TYPES.includes(t.type as never)) {
      errors.push({ field: `tests.${i}.type`, reason: `${label}:案例类型无效` });
    }
  });
  return {
    errors,
    countOk: tests.length >= 5,
    coverageOk:
      typeCount("NORMAL") >= 1 && typeCount("BOUNDARY") >= 1 && typeCount("FAILURE") + typeCount("NA") >= 1,
  };
}

// ---------- 敏感信息红线扫描 ----------
interface SensitivePattern {
  re: RegExp;
  label: string;
}

const SENSITIVE_PATTERNS: SensitivePattern[] = [
  { re: /\bsk-[A-Za-z0-9_-]{16,}\b/, label: "疑似API密钥(sk-开头)" },
  { re: /\bAKIA[0-9A-Z]{16}\b/, label: "疑似云访问密钥" },
  { re: /\b\d{17}[\dXx]\b/, label: "疑似身份证号" },
  { re: /\b1[3-9]\d{9}\b/, label: "疑似手机号" },
  { re: /(密码|口令|secret|token)\s*[::=]\s*[^\s,;]{4,}/i, label: "疑似明文密码或令牌" },
  { re: /\bBearer\s+[A-Za-z0-9._-]{20,}/i, label: "疑似Bearer令牌" },
  { re: /\b(10\.\d{1,3}\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)\d{1,3}\.\d{1,3}\b/, label: "疑似内网地址" },
];

export function scanSensitiveText(text: string): string[] {
  if (!text) return [];
  const hits: string[] = [];
  for (const p of SENSITIVE_PATTERNS) {
    if (p.re.test(text)) hits.push(p.label);
  }
  return hits;
}

// 汇总一个项目全部可扫描文本
export function collectProjectText(input: {
  stages: { step: number; data: string }[];
  testCases: TestCaseInput[];
  team?: Record<string, unknown>;
}): string {
  const parts: string[] = [];
  for (const s of input.stages) {
    try {
      const data = JSON.parse(s.data) as Record<string, unknown>;
      for (const v of Object.values(data)) {
        if (typeof v === "string") parts.push(v);
      }
    } catch {
      /* 忽略损坏JSON */
    }
  }
  for (const t of input.testCases) {
    parts.push([t.name, t.input, t.expected, t.actual, t.failureReason].filter(Boolean).join(" "));
  }
  if (input.team) {
    for (const v of Object.values(input.team)) {
      if (typeof v === "string") parts.push(v);
    }
  }
  return parts.join("\n");
}

// ---------- 赛道合法性 ----------
export function isValidTrack(track?: string | null): boolean {
  return !!track && TRACK_KEYS.includes(track);
}

// ---------- 第1步合规勾选 ----------
export function rulesAgreed(stages: { step: number; data: string }[]): boolean {
  const data = getStageData(stages, 1);
  return RULE_CHECKBOX_KEYS.every((k) => data[k] === true);
}

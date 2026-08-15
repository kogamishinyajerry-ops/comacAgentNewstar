// 进度引擎:一个函数同时回答两个问题——
// 参与者"我现在的最小下一步是什么";组织者"这个项目卡在哪、还差多少"。
// 纯函数,无副作用,供工作台/进展中枢/测试复用。

import { getStepConfig, STEPS, TEAM_FIELDS } from "./steps";
import { closedLoopMissing, getStageData, rulesAgreed, validateTestCases } from "./validation";

/** 进度引擎所需的最小项目形状(loadProjectBundle 的子集,便于测试构造) */
export interface ProjectBundleLike {
  project: {
    title: string;
    track: string | null;
    status: string;
    returnReason?: string | null;
    createdAt: Date | string;
    submittedAt: Date | string | null;
  };
  team: Record<string, unknown>;
  stages: { step: number; data: string }[];
  testCases: { name: string; type: string; input: string; expected: string }[];
  stageTimes?: (Date | string)[];
  testTimes?: (Date | string)[];
  feedbackTimes?: (Date | string)[];
}

export type StepStatus = "done" | "in_progress" | "todo" | "blocked";

export interface StepProgress {
  step: number;
  title: string;
  status: StepStatus;
  pct: number;
  missing: string[]; // 未完成字段标签
}

export interface ProjectProgress {
  overallPct: number;
  steps: StepProgress[];
  currentStep: number; // 建议跳转的步骤
  nextHint: string; // 最小下一步文案
  urgent: boolean; // 存在阻塞提交的硬缺口
  tests: { count: number; passOk: boolean; coverageOk: boolean };
  closedLoopOk: boolean;
  disclosureOk: boolean;
  lastActiveAt: string; // ISO
  staleDays: number; // 距最后活动天数
}

const has = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

/** 各步骤权重(合计100),材料类步骤更重 */
const WEIGHTS: Record<number, number> = { 1: 5, 2: 10, 3: 5, 4: 15, 5: 15, 6: 15, 7: 5, 8: 20, 9: 5, 10: 5 };

function stepFields(bundle: ProjectBundleLike, step: number): { pct: number; missing: string[]; missingKeys: string[] } {
  const cfg = getStepConfig(step);
  if (!cfg || cfg.fields.length === 0) return { pct: 0, missing: [], missingKeys: [] };
  const data = getStageData(bundle.stages, step);
  const missingFields = cfg.fields.filter((f) => (f.type === "checkbox" ? data[f.key] !== true : !has(data[f.key])));
  return {
    pct: Math.round(((cfg.fields.length - missingFields.length) / cfg.fields.length) * 100),
    missing: missingFields.map((f) => f.label.split("(")[0].slice(0, 14)),
    missingKeys: missingFields.map((f) => f.key),
  };
}

export function computeProjectProgress(
  bundle: ProjectBundleLike,
  opts: { now?: Date; hasSnapshot?: boolean; feedbackCount?: number } = {}
): ProjectProgress {
  const now = opts.now ?? new Date();
  const submitted = ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(bundle.project.status);
  const returned = bundle.project.status === "RETURNED";

  const teamDisclosureMissing = TEAM_FIELDS.filter((f) => !has((bundle.team as unknown as Record<string, unknown>)[f.key])).map(
    (f) => f.label
  );
  const disclosureOk = teamDisclosureMissing.length === 0;
  const trackOk = !!bundle.project.track;
  const loopMissing = closedLoopMissing(bundle.stages);
  const closedLoopOk = loopMissing.length === 0;
  const testResult = validateTestCases(bundle.testCases);

  // 各步骤状态与完成度
  const steps: StepProgress[] = STEPS.map((cfg) => {
    const step = cfg.step;
    let pct = 100;
    let missing: string[] = [];
    let status: StepStatus = "done";

    if (step === 1) {
      const ok = rulesAgreed(bundle.stages);
      pct = ok ? 100 : 0;
      missing = ok ? [] : ["合规勾选"];
      status = ok ? "done" : "todo";
    } else if (step === 2) {
      pct = Math.round(((5 - teamDisclosureMissing.length) / 5) * 100);
      missing = teamDisclosureMissing;
      status = disclosureOk ? "done" : "in_progress";
    } else if (step === 3) {
      pct = trackOk ? 100 : 0;
      missing = trackOk ? [] : ["选择赛道"];
      status = trackOk ? "done" : "todo";
    } else if ([4, 5, 6].includes(step)) {
      const r = stepFields(bundle, step);
      pct = r.pct;
      missing = r.missing;
      status = r.pct === 100 ? "done" : r.pct === 0 ? "todo" : "in_progress";
      // 该步缺失的字段若全部属于求证闭环红线字段 → 标记阻塞
      const loopKeysHere = closedLoopMissing(bundle.stages).filter((f) => f.step === step).map((f) => f.key);
      if (r.missingKeys.length > 0 && r.missingKeys.every((k) => loopKeysHere.includes(k))) {
        status = "blocked";
        missing = loopKeysHere.map((k) => loopMissing.find((f) => f.key === k)?.label ?? k);
      }
    } else if (step === 7) {
      pct = (opts.feedbackCount ?? 0) > 0 ? 100 : 0;
      missing = pct === 100 ? [] : ["获取一次Agent诊断"];
      status = pct === 100 ? "done" : "todo";
    } else if (step === 8) {
      const count = bundle.testCases.length;
      const countPct = Math.min(100, Math.round((count / 5) * 100));
      pct = testResult.errors.length === 0 ? 100 : Math.round(countPct * 0.7 + (testResult.coverageOk ? 30 : 0));
      missing = testResult.errors.slice(0, 2).map((e) => e.reason);
      status = pct === 100 ? "done" : count === 0 ? "todo" : "in_progress";
    } else if (step === 9) {
      pct = submitted || (opts.hasSnapshot ?? false) ? 100 : 0;
      missing = pct === 100 ? [] : ["运行预检并提交"];
      status = pct === 100 ? "done" : "todo";
    } else {
      pct = submitted ? 100 : 0;
      missing = submitted ? [] : ["等待提交"];
      status = submitted ? "done" : "todo";
    }

    return { step, title: cfg.title, status, pct, missing };
  });

  const overallPct = submitted ? 100 : Math.min(99, Math.round(steps.reduce((a, s) => a + (WEIGHTS[s.step] * s.pct) / 100, 0)));

  // 最后活动时间:步骤保存/测试重建/快照/反馈的最新时间
  const times: number[] = [new Date(bundle.project.createdAt).getTime()];
  if (bundle.project.submittedAt) times.push(new Date(bundle.project.submittedAt).getTime());
  for (const t of bundle.stageTimes ?? []) times.push(new Date(t).getTime());
  for (const t of bundle.testTimes ?? []) times.push(new Date(t).getTime());
  for (const t of bundle.feedbackTimes ?? []) times.push(new Date(t).getTime());
  const lastActiveAt = new Date(Math.max(...times));
  const staleDays = Math.max(0, Math.floor((now.getTime() - lastActiveAt.getTime()) / 86400000));

  // 最小下一步(优先级从高到低)
  const firstTodo = steps.find((s) => s.status !== "done");
  let currentStep = submitted ? 10 : firstTodo?.step ?? 10;
  let nextHint: string;
  let urgent = false;

  if (returned) {
    nextHint = `先处理退回意见(${bundle.project.returnReason || "按组织者意见补充"}),再回第9步重新预检提交`;
    currentStep = 9;
    urgent = true;
  } else if (submitted) {
    nextHint = "已提交,等待组织者处理;期间可继续打磨材料或准备90秒Demo";
  } else if (!rulesAgreed(bundle.stages)) {
    nextHint = "完成第1步的三项合规勾选(约3分钟)";
  } else if (!disclosureOk) {
    nextHint = `第2步补齐原创披露:${teamDisclosureMissing[0]}`;
  } else if (!trackOk) {
    nextHint = "第3步:从四个赛道中选一个(之后可改)";
  } else {
    const s4 = steps.find((x) => x.step === 4)!;
    if (s4.status !== "done") {
      nextHint = s4.missing[0] ? `第4步补「${s4.missing[0]}」` : "完成第4步真问题描述";
    } else if (!closedLoopOk) {
      // 红线优先于其余缺字段:真问题已描述后,闭环缺口就是最重要的事
      nextHint = `补求证闭环(红线):${loopMissing.map((f) => f.label).join("、")}`;
      currentStep = loopMissing[0].step;
      urgent = true;
    } else {
      const s5 = steps.find((x) => x.step === 5)!;
      const s6 = steps.find((x) => x.step === 6)!;
      if (s5.status !== "done") {
        nextHint = s5.missing[0] ? `第5步补「${s5.missing[0]}」` : "完成第5步判定标准";
      } else if (s6.status !== "done") {
        nextHint = s6.missing[0] ? `第6步补「${s6.missing[0]}」` : "完成第6步MVP与人机边界";
      } else if (testResult.errors.length) {
        nextHint = `第8步:${testResult.errors[0].reason}`;
        currentStep = 8;
      } else {
        nextHint = "材料已齐:去第9步运行提交预检,生成三件套后提交";
        currentStep = 9;
      }
    }
  }

  return {
    overallPct,
    steps,
    currentStep,
    nextHint,
    urgent,
    tests: { count: bundle.testCases.length, passOk: bundle.testCases.length >= 5, coverageOk: testResult.coverageOk },
    closedLoopOk,
    disclosureOk,
    lastActiveAt: lastActiveAt.toISOString(),
    staleDays,
  };
}

/** 组织者视角的卡点摘要(一行) */
export function blockerSummary(p: ProjectProgress, status: string): string {
  if (status === "RETURNED") return "退回待处理";
  if (["SUBMITTED", "PRELIMINARY", "FINAL"].includes(status)) return "已提交";
  if (status === "ARCHIVED") return "已归档";
  if (!p.disclosureOk) return "原创披露不全";
  if (!p.closedLoopOk) return "求证闭环缺失";
  if (!p.tests.passOk || !p.tests.coverageOk) return `测试${p.tests.count}/5`;
  return p.nextHint;
}

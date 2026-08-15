// 三项轻交付生成器:一页小实验卡、可见结果清单、90秒Demo脚本(纯函数)

import { getStageData, type TestCaseInput } from "./validation";
import { TRACKS } from "./constants";
import type { PrecheckInput } from "./precheck";

export interface DeliverableInput extends PrecheckInput {
  title: string;
  teamName: string;
  memberNames: string[];
}

export interface CardSection {
  heading: string;
  rows: { label: string; value: string }[];
}

function trackName(key?: string | null): string {
  return TRACKS.find((t) => t.key === key)?.name ?? "未选择";
}

function first(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v.trim() : "—";
}

export function buildExperimentCard(input: DeliverableInput): {
  header: { title: string; track: string; team: string; members: string; slogan: string };
  sections: CardSection[];
} {
  const s4 = getStageData(input.stages, 4);
  const s5 = getStageData(input.stages, 5);
  const s6 = getStageData(input.stages, 6);
  const pass = input.testCases.filter((t) => t.verdict === "PASS").length;
  const fail = input.testCases.filter((t) => t.verdict === "FAIL").length;

  return {
    header: {
      title: input.title,
      track: trackName(input.track),
      team: input.teamName,
      members: input.memberNames.join("、"),
      slogan: "发现一个真问题,做一个可验证的解法。",
    },
    sections: [
      {
        heading: "一、真问题",
        rows: [
          { label: "目标用户", value: first(s4, "targetUser") },
          { label: "使用场景", value: first(s4, "scenario") },
          { label: "发生频率", value: first(s4, "frequency") },
          { label: "最麻烦的一步", value: first(s4, "worstStep") },
          { label: "当前成本", value: first(s4, "currentCost") },
          { label: "为什么值得解决", value: first(s4, "whyWorth") },
        ],
      },
      {
        heading: "二、判定标准",
        rows: [
          { label: "什么算可用", value: first(s5, "usableResult") },
          { label: "不可接受的错误", value: first(s5, "unacceptableErrors") },
          { label: "判断依据", value: first(s5, "judgmentSource") },
          { label: "异常停止条件", value: first(s5, "stopConditions") },
        ],
      },
      {
        heading: "三、MVP与求证闭环",
        rows: [
          { label: "一句话MVP", value: first(s6, "oneSentenceMvp") },
          { label: "核心闭环", value: first(s6, "coreLoop") },
          { label: "可验证指标", value: first(s6, "verifiableMetric") },
          { label: "AI负责", value: first(s6, "aiResponsibility") },
          { label: "自动检查范围", value: first(s6, "autoCheckScope") },
          { label: "人工确认点", value: first(s6, "humanConfirmPoint") },
          { label: "最终责任人", value: first(s6, "finalOwner") },
          { label: "本期不做", value: first(s6, "notDoing") },
        ],
      },
      {
        heading: `四、测试证据(${input.testCases.length}例:符合${pass} / 不符合${fail} / 其余待判定)`,
        rows: input.testCases.map((t) => ({
          label: `${t.name}(${t.type === "NORMAL" ? "常规" : t.type === "BOUNDARY" ? "边界" : t.type === "FAILURE" ? "失败" : "不适用"})`,
          value: [
            `输入:${t.input || "—"}`,
            `预期:${t.expected || "—"}`,
            `实际:${t.actual || "—"}`,
            `判定:${t.verdict === "PASS" ? "符合预期" : t.verdict === "FAIL" ? "不符合预期" : t.verdict === "NA" ? "不适用" : "待判定"}`,
            t.manualFix ? `人工修改:${t.manualFix}` : "",
            t.failureReason ? `失败原因:${t.failureReason}` : "",
          ]
            .filter(Boolean)
            .join(" | "),
        })),
      },
      {
        heading: "五、原创与披露",
        rows: [
          { label: "实际开始时间", value: input.team.startTime || "—" },
          { label: "活动前已有基础", value: input.team.existingBase || "—" },
          { label: "活动期间新增", value: input.team.addedDuringActivity || "—" },
          { label: "外部资源", value: input.team.externalResources || "—" },
          { label: "帮助人员", value: input.team.helpers || "—" },
        ],
      },
    ],
  };
}

// 可见结果清单:链接、截图、提示词、流程图、工作流、前后对比或可运行原型
export interface ChecklistItem {
  key: string;
  label: string;
  desc: string;
}

export const VISIBLE_RESULT_CHECKLIST: ChecklistItem[] = [
  { key: "link", label: "可访问链接", desc: "原型、文档或演示的在线地址(内网或脱敏环境)" },
  { key: "screenshots", label: "关键截图(≥3张)", desc: "覆盖输入、处理过程、输出与人工确认环节" },
  { key: "prompts", label: "提示词", desc: "使用的核心提示词文本" },
  { key: "flow", label: "流程图", desc: "标出检查环节与人工确认点的闭环流程" },
  { key: "workflow", label: "工作流配置", desc: "若使用编排工具,导出工作流截图或文件" },
  { key: "before_after", label: "前后对比", desc: "同一任务手工 vs 使用后的时间/质量对比" },
  { key: "prototype", label: "可运行原型", desc: "可直接操作的Demo(可选)" },
];

export function buildVisibleResultChecklist(): ChecklistItem[] {
  return VISIBLE_RESULT_CHECKLIST;
}

export interface DemoScriptSegment {
  time: string;
  title: string;
  lines: string[];
}

export function buildDemoScript(input: DeliverableInput): DemoScriptSegment[] {
  const s4 = getStageData(input.stages, 4);
  const s6 = getStageData(input.stages, 6);
  const failure = input.testCases.find((t) => t.verdict === "FAIL" || t.type === "FAILURE");
  const pass = input.testCases.find((t) => t.verdict === "PASS");
  return [
    {
      time: "00:00—00:15",
      title: "开场:真问题",
      lines: [
        `大家好,我们是${input.teamName}(${input.memberNames.join("和")})。`,
        `${first(s4, "targetUser")}在${first(s4, "scenario")}这件事上,${first(s4, "frequency")}就要遇到一次,最麻烦的是${first(s4, "worstStep")}。`,
      ],
    },
    {
      time: "00:15—00:45",
      title: "演示:核心闭环",
      lines: [
        `一句话MVP:${first(s6, "oneSentenceMvp")}`,
        `现在演示完整闭环:${first(s6, "coreLoop")}`,
        `注意检查环节:${first(s6, "autoCheckScope")};人工确认点:${first(s6, "humanConfirmPoint")}——最终责任在${first(s6, "finalOwner")}。`,
      ],
    },
    {
      time: "00:45—01:15",
      title: "证据:测试与失败案例",
      lines: [
        pass
          ? `先看通过案例「${pass.name}」:输入${pass.input},结果符合预期${pass.actual || ""}。`
          : "展示一个通过案例的输入与输出。",
        failure
          ? `再看失败案例「${failure.name}」:${failure.failureReason || failure.input}——我们如实展示,人工修改是${failure.manualFix || "记录并转人工处理"}。`
          : "展示一个失败或不适用案例,说明如何转人工处理。",
      ],
    },
    {
      time: "01:15—01:30",
      title: "收尾:价值与边界",
      lines: [
        `可验证指标:${first(s6, "verifiableMetric")}。`,
        `明确不做:${first(s6, "notDoing")}。以上就是我们的90秒。`,
      ],
    },
  ];
}

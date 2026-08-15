// 全局常量:角色、状态、赛道、测试类型、风险类型(SQLite 无枚举,统一在此校验)

export const ROLES = ["PARTICIPANT", "ORGANIZER", "JUDGE", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
  PARTICIPANT: "参与者",
  ORGANIZER: "组织者",
  JUDGE: "评委",
  ADMIN: "管理员",
};

export const TEAM_MODES = ["SOLO", "ECHO", "DELTA", "DUO"] as const;
export type TeamMode = (typeof TEAM_MODES)[number];
export const TEAM_MODE_LABELS: Record<TeamMode, string> = {
  SOLO: "单人参赛",
  ECHO: "Echo(问题与需求)",
  DELTA: "Delta(构建与测试)",
  DUO: "双人互补",
};

export const PROJECT_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "RETURNED",
  "PRELIMINARY",
  "FINAL",
  "ARCHIVED",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "草稿",
  SUBMITTED: "已提交",
  RETURNED: "退回补充",
  PRELIMINARY: "预赛",
  FINAL: "决赛",
  ARCHIVED: "已归档",
};

export interface TrackDef {
  key: string;
  name: string;
  description: string;
  suitable: string;
  unsuitable: string;
  example: string;
}

// 四个正式赛道,固定不可由普通用户新增
export const TRACKS: TrackDef[] = [
  {
    key: "personal-efficiency",
    name: "个人效率助手",
    description: "面向个人日常工作的效率提升小工具,解决一个人反复做的琐事。",
    suitable: "周报整理、会议纪要、资料摘要、日程提醒、邮件分诊等个人高频小事",
    unsuitable: "需要全公司统一接入的流程系统、涉及敏感数据自动化处理的场景",
    example: "每周五把散落的聊天记录和文档自动汇总成一页周报草稿,人工确认后发出",
  },
  {
    key: "knowledge-qa",
    name: "知识问答助手",
    description: "围绕一组明确资料构建的问答助手,答案必须可溯源。",
    suitable: "部门规章问答、产品手册查询、新员工常见问题、公开资料检索问答",
    unsuitable: "没有明确资料来源的开放问答、需要保证百分百准确的业务决策",
    example: "把公开的产品FAQ整理成知识库,回答附带出处,不确定时明确说不知道",
  },
  {
    key: "process-automation",
    name: "流程自动化工具",
    description: "把一条重复流程自动化,并保留人工确认节点。",
    suitable: "表单搬运、数据核对、格式转换、批量通知、日报收集等规则明确流程",
    unsuitable: "规则说不清、判定标准无法写成检查条件的模糊流程",
    example: "自动核对两张表的数据差异,高亮不一致项,由人工确认后生成差异报告",
  },
  {
    key: "engineering-agent",
    name: "工程业务Agent",
    description: "辅助工程或业务环节的专职Agent,边界清晰、结果可检查。",
    suitable: "日志初筛、测试数据生成、代码评审初查、工单分类、风险提示",
    unsuitable: "替代关键工程判断、直接放行质量、接入生产系统的场景",
    example: "对提交的日志先做异常初筛并归类,工程师复核结论后才进入处理流程",
  },
];
export const TRACK_KEYS = TRACKS.map((t) => t.key);

export const TEST_TYPES = ["NORMAL", "BOUNDARY", "FAILURE", "NA"] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const TEST_TYPE_LABELS: Record<TestType, string> = {
  NORMAL: "常规",
  BOUNDARY: "边界/复杂",
  FAILURE: "失败",
  NA: "不适用",
};

export const VERDICTS = ["PENDING", "PASS", "FAIL", "NA"] as const;
export type Verdict = (typeof VERDICTS)[number];
export const VERDICT_LABELS: Record<Verdict, string> = {
  PENDING: "待判定",
  PASS: "符合预期",
  FAIL: "不符合预期",
  NA: "不适用",
};

export const RISK_TYPES = [
  "scope_too_large",
  "sensitive_data",
  "existing_project",
  "team_size",
  "no_verification",
  "engineering_judgement",
  "production_integration",
  "other",
] as const;
export type RiskType = (typeof RISK_TYPES)[number];
export const RISK_LABELS: Record<RiskType, string> = {
  scope_too_large: "范围过大",
  sensitive_data: "敏感数据",
  existing_project: "已有项目搬运",
  team_size: "团队规模",
  no_verification: "缺少求证闭环",
  engineering_judgement: "工程判断外包给AI",
  production_integration: "接入生产系统",
  other: "其他风险",
};

export const ROUND_KEYS = ["PRELIMINARY", "FINAL"] as const;
export type Round = (typeof ROUND_KEYS)[number];
export const ROUND_LABELS: Record<Round, string> = {
  PRELIMINARY: "预赛",
  FINAL: "决赛",
};

export const PRECHECK_NOTE = "仅供完善材料参考,不代表正式评审结果。";

export const SLOGAN = "发现一个真问题,做一个可验证的解法。";

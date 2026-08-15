// 参与者端 10 步流程的集中配置:字段、必填、示例、预计用时、Agent 侧重点

export type FieldType = "text" | "textarea" | "select" | "number" | "checkbox";

export interface StepField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  options?: { value: string; label: string }[];
}

export interface StepConfig {
  step: number;
  slug: string;
  title: string;
  subtitle: string;
  minutes: number;
  fields: StepField[];
  coachFocus: string;
}

export const STEPS: StepConfig[] = [
  {
    step: 1,
    slug: "rules",
    title: "规则与数据承诺",
    subtitle: "了解活动规则,完成合规勾选后才能继续。",
    minutes: 3,
    coachFocus: "确认用户理解活动边界:轻交付、5例测试、求证闭环红线与数据红线。",
    fields: [
      {
        key: "agreeRules",
        label: "我已阅读并接受活动规则:每队1—2人、四赛道、三项轻交付、四维40分评分",
        type: "checkbox",
        required: true,
      },
      {
        key: "agreeDataSafety",
        label: "数据承诺:只使用公开数据、模拟数据、个人自有非敏感数据或已脱敏样例;不上传未经授权敏感资料,不展示账号密钥,不绕过权限审批,不接入生产系统",
        type: "checkbox",
        required: true,
      },
      {
        key: "agreeOriginality",
        label: "原创承诺:如实披露开始时间、已有基础、活动期间新增内容与外部资源;核心工作由本队1—2名成员完成",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    step: 2,
    slug: "team",
    title: "个人或双人组队",
    subtitle: "创建队伍或分享邀请码邀请一名搭档(最多2人),并如实填写原创披露。",
    minutes: 5,
    coachFocus: "检查组队合规(≤2人)与原创披露完整度:开始时间、已有基础、新增内容、外部资源、帮助人员。",
    fields: [],
  },
  {
    step: 3,
    slug: "track",
    title: "选择赛道",
    subtitle: "四个正式赛道固定不变,根据问题特征选择,可参考Agent建议但由你决定。",
    minutes: 3,
    coachFocus: "判断问题与赛道的匹配度,提示跨赛道或过泛的选择。",
    fields: [],
  },
  {
    step: 4,
    slug: "problem",
    title: "描述真问题",
    subtitle: "写清楚谁、在什么场景、多久遇到一次什么麻烦。空泛问题会被识别。",
    minutes: 15,
    coachFocus: "识别空泛问题、伪需求、范围过大、缺少真实用户;追问频率、成本与最痛一步。",
    fields: [
      { key: "targetUser", label: "目标用户", type: "text", required: true, placeholder: "例:本部门新入职的结构设计工程师" },
      { key: "scenario", label: "使用场景", type: "textarea", required: true, rows: 3, placeholder: "例:每次评审前要把3个系统的变更记录手动拼成一份对比说明" },
      { key: "frequency", label: "发生频率", type: "text", required: true, placeholder: "例:每周2—3次,每次约40分钟" },
      { key: "currentProcess", label: "当前流程", type: "textarea", required: true, rows: 3, placeholder: "例:打开系统A导出→复制到表格→打开系统B核对→手工排版" },
      { key: "worstStep", label: "最麻烦/最易错的一步", type: "textarea", required: true, rows: 2, placeholder: "例:两系统字段名不一致,人工对错行后返工" },
      { key: "currentCost", label: "当前时间/质量成本", type: "text", required: true, placeholder: "例:每周约2小时,且每月约1次错漏" },
      { key: "whyWorth", label: "为什么值得解决", type: "textarea", required: true, rows: 2, placeholder: "例:节省的时间可用于复核,错漏直接影响评审质量" },
    ],
  },
  {
    step: 5,
    slug: "requirements",
    title: "需求挖掘与判定标准",
    subtitle: "需求没挖清楚,不要急着自动化。",
    minutes: 20,
    coachFocus: "检查判定标准是否可执行、是否有明确依据、异常何时停止并交给人。",
    fields: [
      { key: "usableResult", label: "什么结果算可用", type: "textarea", required: true, rows: 2, placeholder: "例:生成的对比说明无事实错误,人工10分钟内可确认发出" },
      { key: "unacceptableErrors", label: "不可接受的错误", type: "textarea", required: true, rows: 2, placeholder: "例:变更条目遗漏、日期或责任人有错" },
      { key: "judgmentSource", label: "判断依据来自哪里", type: "textarea", required: true, rows: 2, placeholder: "例:以两系统导出的原始记录为准,字段对照表见附件", hint: "求证闭环字段:检查环节的依据必须明确" },
      { key: "inputInfo", label: "输入信息", type: "textarea", required: true, rows: 2, placeholder: "例:两系统导出的CSV(已脱敏样例)" },
      { key: "outputFormat", label: "输出格式", type: "text", required: true, placeholder: "例:一页Markdown对比说明" },
      { key: "stopConditions", label: "异常停止条件", type: "textarea", required: true, rows: 2, placeholder: "例:数据行数对不上、字段缺失、疑似非公开信息", hint: "求证闭环字段:哪些异常必须停下交给人" },
      { key: "initialTestCases", label: "初步测试案例设想", type: "textarea", required: true, rows: 3, placeholder: "例:①常规变更 ②同日多条变更 ③导出为空" },
    ],
  },
  {
    step: 6,
    slug: "mvp",
    title: "MVP、人机边界与工具链",
    subtitle: "一句话MVP、一个核心闭环、一个可验证指标。",
    minutes: 20,
    coachFocus: "砍掉平台化/多Agent化/非必要功能;检查人机边界五要素与最简工具链。",
    fields: [
      { key: "oneSentenceMvp", label: "一句话MVP", type: "text", required: true, placeholder: "例:把两份导出记录自动整理成一页人工可确认的对比说明" },
      { key: "coreUser", label: "一个核心用户", type: "text", required: true, placeholder: "例:我自己(新入职结构设计工程师)" },
      { key: "coreProblem", label: "一个核心问题", type: "text", required: true, placeholder: "例:评审前手工拼对比说明耗时且易错" },
      { key: "coreLoop", label: "一个核心闭环", type: "textarea", required: true, rows: 2, placeholder: "例:两份CSV→自动对齐合并→按对照表检查→人工确认→输出说明", hint: "输入→处理→检查→人工确认→输出" },
      { key: "verifiableMetric", label: "一个可验证指标", type: "text", required: true, placeholder: "例:单次准备时间从40分钟降到10分钟以内" },
      { key: "aiResponsibility", label: "AI负责什么", type: "textarea", required: true, rows: 2, placeholder: "例:字段对齐、格式整理、差异高亮草稿" },
      { key: "humanResponsibility", label: "人负责什么", type: "textarea", required: true, rows: 2, placeholder: "例:核对差异结论、确认放行、处理异常", hint: "求证闭环字段:人工确认点的基础" },
      { key: "autoCheckScope", label: "自动检查范围", type: "textarea", required: true, rows: 2, placeholder: "例:条目数量一致、日期格式、责任人字段非空", hint: "求证闭环字段:机器自动检查的明确范围" },
      { key: "humanConfirmPoint", label: "人工确认点", type: "textarea", required: true, rows: 2, placeholder: "例:发出前逐条确认差异项", hint: "求证闭环字段:人在哪一步确认" },
      { key: "finalOwner", label: "最终责任人", type: "text", required: true, placeholder: "例:我本人(单人队)", hint: "求证闭环字段:责任不可全部交给AI" },
      { key: "tools", label: "使用什么工具", type: "textarea", required: true, rows: 2, placeholder: "例:GLM API + Python脚本 + 表格软件" },
      { key: "notDoing", label: "本期不做什么", type: "textarea", required: true, rows: 2, placeholder: "例:不做多系统直连、不做自动发送、不做移动端" },
    ],
  },
  {
    step: 7,
    slug: "diagnosis",
    title: "阶段化Agent诊断",
    subtitle: "汇总前六步,专职Agent给出判断、缺口、问题、建议与风险,可逐条采纳或忽略。",
    minutes: 5,
    coachFocus: "综合诊断:先诊断、再追问、后建议;每次最多3条建议;只给最小下一步。",
    fields: [],
  },
  {
    step: 8,
    slug: "tests",
    title: "5个测试案例",
    subtitle: "至少5例,必须覆盖常规、边界或复杂、以及至少1个失败或不适用情况。失败案例鼓励展示。",
    minutes: 20,
    coachFocus: "检查测试覆盖度与判定完整性,提醒失败案例的价值。",
    fields: [],
  },
  {
    step: 9,
    slug: "precheck",
    title: "提交预检与三件套生成",
    subtitle: "硬规则校验通过后才能提交;自动生成小实验卡、可见结果清单和90秒Demo脚本。",
    minutes: 10,
    coachFocus: "执行硬规则校验与四维预检,明确告知如何解除阻塞。",
    fields: [],
  },
  {
    step: 10,
    slug: "status",
    title: "状态与后续跟踪",
    subtitle: "查看草稿/已提交/退回/预赛/决赛/归档状态、历史版本与30/60/90天跟踪。",
    minutes: 2,
    coachFocus: "说明后续状态流转与跟踪安排。",
    fields: [],
  },
];

export function getStepConfig(step: number): StepConfig | undefined {
  return STEPS.find((s) => s.step === step);
}

// 第2步在 Team 实体上编辑的原创披露字段
export const TEAM_FIELDS: StepField[] = [
  { key: "startTime", label: "实际开始时间", type: "text", required: true, placeholder: "例:2026-08-20(工作日晚间与周末)" },
  { key: "existingBase", label: "活动前已有基础", type: "textarea", required: true, rows: 2, placeholder: "例:无,或:已有一次手工整理的表格模板" },
  { key: "addedDuringActivity", label: "活动期间新增内容", type: "textarea", required: true, rows: 2, placeholder: "例:提示词、对齐脚本、5个测试案例与全部文档" },
  { key: "externalResources", label: "外部资源与依赖", type: "textarea", required: true, rows: 2, placeholder: "例:GLM API、WorkBuddy、某开源表格库(须如实披露)", hint: "开源项目/模板/模型/外部资源均须列出" },
  { key: "helpers", label: "提供过帮助的人员", type: "textarea", required: true, rows: 2, placeholder: "例:无,或:同事王某提供过业务口径咨询(非核心工作)" },
];

// 第1步合规勾选的 key(供预检复用)
export const RULE_CHECKBOX_KEYS = ["agreeRules", "agreeDataSafety", "agreeOriginality"];

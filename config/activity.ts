/**
 * 活动事实与实践叙事配置。
 *
 * 红线(docs/product/04):日期、链接、主办、规则、奖项等未获正式确认前,
 * 一律为 null / 空数组,UI 展示时统一使用 `PENDING_LABEL` 兜底,不得编造。
 * 对齐 config/activity.example.json 的结构与默认值。
 *
 * 这里不读取文件系统,可安全被 Hub 客户端组件消费；构建期校验在
 * scripts/validate-activity-config.ts 中完成。
 */
import {
  DEFAULT_PENDING_LABEL,
  resolveApprovedLogoPath,
  type ActivityConfig,
} from "@/lib/hub/activity-config";

export const PENDING_LABEL = DEFAULT_PENDING_LABEL;

/**
 * 仅允许经过品牌授权、位于 public/brand/ 的精确资产路径。
 * 当前没有得到授权的 Logo，因此白名单必须为空。
 */
export const ACTIVITY_LOGO_PATH_WHITELIST = [] as const;

export const activity = {
  /** 阶段一既有显示名，不代表活动正式名称已确认；site.ts 只能从此处派生同一身份。 */
  identity: {
    name: "COMAC 青年 AI Agent 创新实践月",
    shortName: "AI Agent 创新实践月",
    eyebrow: "COMAC 青年 AI Agent 创新实践月",
  },
  status: "configuration_pending",

  /** 主办/承办/协办正式写法未确认 */
  organizers: [],

  dates: {
    registrationDeadline: null,
    startDate: null,
    endDate: null,
  },

  links: {
    registration: null,
    login: null,
    guide: null,
    support: null,
  },

  /** 正式规则未提供，因此每项保持为 nullable 的结构化记录。 */
  rules: {
    participation: null,
    teamSize: null,
    workRelated: null,
    externalTools: null,
    dataSecurityAndIp: null,
    submissionMaterials: null,
    evaluation: null,
  },

  /** 产品能力开关；不是对外活动规则或正式事实。 */
  featureFlags: {
    /** 阶段二已获用户授权；仍受服务端环境、同源与限流边界约束。 */
    realLlm: true,
  },

  brand: {
    approvedLogoPath: null,
    useTextMarkUntilApproved: true,
  },

  displayFallback: PENDING_LABEL,
} satisfies ActivityConfig;

/**
 * 供未来品牌组件消费的唯一安全 Logo 接口。白名单为空时稳定返回 null。
 */
export const approvedActivityLogoPath = resolveApprovedLogoPath(
  activity.brand.approvedLogoPath,
  ACTIVITY_LOGO_PATH_WHITELIST,
);

/** 取活动事实;未确认时返回兜底文案 */
export function activityFact(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : PENDING_LABEL;
}

/** 活动时间线的展示行(任一日期未确认则整行进入待确认态) */
export function activityTimeline(): { start: string; end: string; deadline: string } {
  return {
    start: activityFact(activity.dates.startDate),
    end: activityFact(activity.dates.endDate),
    deadline: activityFact(activity.dates.registrationDeadline),
  };
}

/**
 * G0 到场三件套(§31 H5,J-3/J-4,P0-2):下载 WorkBuddy → 加入项目群 → 进入本站。
 * 链接/二维码属活动事实,未确认一律 null,UI 统一展示「待活动配置确认」;
 * 第三步"进入本站"是当前位置标注,不需要链接。
 */
export const arrivalSteps = [
  {
    key: "workbuddy",
    index: "1",
    title: "下载 WorkBuddy",
    detail: "活动协作、项目群与共享文件夹都在 WorkBuddy 上进行。",
    href: null as string | null,
    current: false,
  },
  {
    key: "group",
    index: "2",
    title: "加入项目群",
    detail: "问题定义卡完成后粘贴回群里,让队伍与辅导团队看到。",
    href: null as string | null,
    current: false,
  },
  {
    key: "site",
    index: "3",
    title: "进入本站",
    detail: "你在这里——从第一问开始。",
    href: null as string | null,
    current: true,
  },
] as const;

/**
 * 四节点旅程(§31 H5,J-3/J-4,docs/product/08 §2):操作层结构可见、日期 pending。
 * N1 是当前唯一开放节点;N2–N4 只标「第 N 周开放 · 待活动配置确认」,
 * 不做假状态、不预支未开放节点的能力。节点日期确认后落 activity.dates。
 */
export const journeyNodes = [
  {
    key: "n1",
    node: "N1",
    week: "第 1 周",
    name: "问答初筛",
    outcome: "问题定义卡",
    status: "in-progress",
    href: "/start",
  },
  {
    key: "n2",
    node: "N2",
    week: "第 2 周",
    name: "中期答疑",
    outcome: "验证反馈 + 答疑卡",
    status: "pending",
    href: null as string | null,
  },
  {
    key: "n3",
    node: "N3",
    week: "第 3 周",
    name: "交付冲刺",
    outcome: "Demo/答辩材料精修",
    status: "pending",
    href: null as string | null,
  },
  {
    key: "n4",
    node: "N4",
    week: "第 4 周",
    name: "提交评分",
    outcome: "交付包 + 验收 + 评分",
    status: "pending",
    href: null as string | null,
  },
] as const;

/** 节点状态展示行:N1 进行中,其余「第 N 周开放 · 待活动配置确认」 */
export function journeyNodeStatusLabel(node: (typeof journeyNodes)[number]): string {
  return node.status === "in-progress" ? "进行中" : `${node.week}开放 · ${PENDING_LABEL}`;
}

/**
 * 五段实践路径(§5-D)。桌面横向轨迹,滚动只点亮当前阶段。
 * §31 H5:四节点旅程是操作层,本五段保留为方法论层。
 */
export const journeySteps = [
  {
    key: "discover",
    index: "01",
    title: "发现真实问题",
    summary: "从每天真实发生的工作瞬间里,找一个值得改变的点,而不是从技术名词出发。",
    detail:
      "Coach 的第一问永远是“你最想改变的具体工作瞬间是什么”。具体到场景、角色和时刻,问题才有被验证的可能。",
  },
  {
    key: "define",
    index: "02",
    title: "定义用户与价值",
    summary: "说清楚谁受到影响、损失体现在哪里、改善如何被观察到。",
    detail:
      "“帮助大家提高效率”不算定义。某一类明确用户、一个可观察的损失、一种可验证的改善,才算。",
  },
  {
    key: "necessity",
    index: "03",
    title: "判断为什么需要 Agent",
    summary: "回答评委会问的那一问:为什么普通大模型聊天不够?",
    detail:
      "只有在需要长期记忆、工具调用、专业知识、自动工作流或多步反馈回路时,Agent 才有必要。否则它只是更贵的聊天。",
  },
  {
    key: "build",
    index: "04",
    title: "去外部工具构建并带回证据",
    summary: "平台生成任务包,Coding、调试与测试在你顺手的工具里完成。",
    detail:
      "平台不承担 Coding。它把问题、约束和验收标准组织成任务包,再把运行结果、数据与截图接回来,变成证据。",
  },
  {
    key: "show",
    index: "05",
    title: "用证据完成展示与评审",
    summary: "以“主张—证据—缺口”组织最终叙事,而不是罗列功能清单。",
    detail:
      "评审看到的是:你主张什么、证据是什么、还缺什么。诚实的缺口比注水的完成度更有说服力。",
  },
] as const;

/**
 * 三类角色(§5-F)。参赛者为主视觉,评委与组织者为次要入口。
 */
export const roles = [
  {
    key: "participant",
    name: "参赛者",
    pitch: "找到值得做的问题,并把它变成有证据的作品",
    primary: true,
    href: "/role/participant",
    willSee: [
      "AI Coach 一次一问地帮你把模糊想法压实成问题种子",
      "沉淀下来的判断与结论,而不是散落在聊天记录里",
      "外出构建的任务包,和接回证据后暴露出的缺口",
    ],
    mustDo: [
      "自己回答关键问题——Coach 追问,但结论由你得出",
      "在外部工具中完成实际构建与验证",
      "用证据组织提交与展示,并对主张负责",
    ],
    wontDo: [
      "不会替你决定什么值得做",
      "不会在网页内替你 Coding 或调试",
      "不会用完成度分数代替你的证据",
    ],
  },
  {
    key: "reviewer",
    name: "评委",
    pitch: "先独立理解项目与证据,再做人的判断",
    primary: false,
    href: "/role/reviewer",
    willSee: [
      "结构化的项目叙事:主张、证据与缺口分开呈现",
      "形成过程的留痕,帮助理解结论如何长出来",
      "AI 的第二意见——只在你独立判断之后出现",
    ],
    mustDo: [
      "先形成独立判断,再参考 AI 视角",
      "完成正式评分——这个权力只属于人",
      "指出证据链上真正的薄弱处",
    ],
    wontDo: [
      "不会看到 AI 预先给出的分数或排名",
      "不会在独立判断前被推送其他评委的意见",
      "公共 Hub 不展示或代行评分；正式评分由已授权评委在受保护工作区完成",
    ],
  },
  {
    key: "organizer",
    name: "组织者",
    pitch: "看见共性阻塞与资源需求,而不是窥探私人探索",
    primary: false,
    href: "/role/organizer",
    willSee: [
      "共性阻塞:很多队伍卡在同一类问题上",
      "资源需求的汇总信号,用于安排支持",
      "经过确认或主动共享的公共状态",
    ],
    mustDo: [
      "基于公共信号安排资源与支持",
      "管理动作保持透明、可确认、可撤销",
    ],
    wontDo: [
      "不会看到参赛者的私人探索过程",
      "不会让系统未经确认就执行管理动作",
      "公共 Hub 不展示态势仪表盘；已授权组织者在受保护工作区按规则处理管理事项",
    ],
  },
] as const;

/**
 * 平台边界(§5-G)。
 */
export const platformBoundaries = {
  does: [
    "逐步澄清问题",
    "沉淀关键结论",
    "生成外出构建任务包",
    "接回证据并暴露缺口",
    "组织最终叙事",
  ],
  doesNot: [
    "替用户决定什么值得做",
    "在网页内 Coding",
    "替代专业验证与大规模测试",
    "替评委打分",
    "替组织者执行未经确认的管理动作",
  ],
} as const;

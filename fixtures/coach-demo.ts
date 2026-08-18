/**
 * 确定性三幕 Coach 演示(阶段一:无真实 AI)。
 *
 * 两条入口 × 三幕。每幕逻辑上包含:当前判断 / 最大风险 / 一个关键问题 / 一个回答器,
 * 但视觉上是一幕,只突出主问题(docs/product/01 §2.4、docs/product/02 §3.2)。
 * 文案人格:严格但建设性,不迎合、不泛化夸奖。
 */

export type CoachEntry = "problem" | "idea";

export interface CoachAct {
  /** 当前判断:Coach 对你刚刚给出的信息的确定性读法 */
  judgment: string;
  /** 最大风险:评委视角下此刻最可能被追问的薄弱处 */
  risk: string;
  /** 一个关键问题:本幕唯一的主要问题 */
  question: string;
  /** 回答器占位提示 */
  placeholder: string;
  /** 提交前对空白输入的引导(不指责) */
  emptyHint: string;
}

export const coachDemoActs: Record<CoachEntry, readonly CoachAct[]> = {
  problem: [
    {
      judgment: "还没有结论,这是好事——评委先看的是真实瞬间,不是宏大方向。",
      risk: "最常见的失败不是做不出来,而是问题只存在于设想里,不发生在任何人的具体时刻。",
      question: "你最想改变的具体工作瞬间是什么?",
      placeholder: "写一个真实发生的瞬间:谁在做什么,卡在哪里。",
      emptyHint: "先写一句粗糙的也可以——具体到某个时刻、某件事。",
    },
    {
      judgment: "瞬间成立了。但评委会追问:它落在谁身上,代价是什么。",
      risk: "说不清谁受影响、损失多大,后面所有技术选择都会失去判断依据。",
      question: "这个问题对谁造成了什么具体损失?",
      placeholder: "点出具体的人和代价:时间、返工、等待都算。",
      emptyHint: "试着写出具体的人和具体的代价。",
    },
    {
      judgment: "问题与影响成形。下一问是评委席上一定会出现的一问。",
      risk: "如果一次普通大模型对话就能解决,做成 Agent 反而增加了不必要的复杂度。",
      question: "为什么普通大模型聊天不足以解决它?",
      placeholder: "它真正需要哪几样:记忆、工具、流程、留痕。",
      emptyHint: "想想记忆、工具、固定流程——它真正需要哪一样。",
    },
  ],
  idea: [
    {
      judgment: "你已经带着方案来了。评委做的第一件事,是把方案放回问题里检验。",
      risk: "方案先行是最高频的失败路径:功能做出来了,要解决的问题却讲不具体。",
      question: "先不要描述功能。你观察到的真实问题是什么?",
      placeholder: "只说你看到的现象:谁、在什么时候、被什么困住。",
      emptyHint: "把功能放一放,先说观察到的现象。",
    },
    {
      judgment: "现象开始浮现。它要立得住,必须指明落点和代价。",
      risk: "影响面说不清的问题无法证明被改善,也就无法证明作品的价值。",
      question: "这个问题影响谁，又如何证明它已经被改善?",
      placeholder: "给人和代价,再给一个能观察到的改善信号。",
      emptyHint: "给出人和代价,再给一个改善信号。",
    },
    {
      judgment: "回到你的方案:它必须回答为什么不是一次聊天就能完成的任务。",
      risk: "Agent 必要性立不住,已经写好的功能反而会成为负资产。",
      question: "你的方案里,哪一步是普通大模型聊天做不到、必须靠 Agent 的?",
      placeholder: "指出非聊天不可的一环:记忆、工具、流程或反馈。",
      emptyHint: "选你最真实的理由:记忆、工具、流程、反馈。",
    },
  ],
};

/**
 * 第四幕(问题定义 Artifact)的三轮确定性深化文案。
 * 维度固定且与种子的三条缺口一一对应(docs/product/05 §4 阶段1);
 * live 模型同样被要求按此维度序提问,客户端据此确定性合成深化记录。
 */
export const coachDemoArtifactActs: readonly CoachAct[] = [
  {
    judgment: "影响已有人物与代价,但评委还会问规模:多少人、多频繁,决定问题的分量。",
    risk: "规模说不清,小改进会被当成大问题,大问题反而被低估。",
    question: "受影响的人大约有多少、多长时间发生一次?",
    placeholder: "给一个粗估:大约多少人、多久一次、每次代价多少。",
    emptyHint: "粗估也可以——人数、频率、单次代价,说一样就有分量。",
  },
  {
    judgment: "要证明被改善,先得说清改善前后能观察到什么不同。",
    risk: "没有可观察的信号,任何技术方案的效果都无法自证。",
    question: "改善之后,你能观察到什么具体变化来说明它成立了?",
    placeholder: "写一个能看出来的信号:少了哪步、快了多久、少了什么错。",
    emptyHint: "找一个能观察到的信号:更少、更快、更准、更省。",
  },
  {
    judgment: "必要性此刻仍是一句主张,评委会要求指出非聊天不可的一环。",
    risk: "若每一步普通对话都能完成,Agent 就只是更贵的聊天。",
    question: "整个流程里,哪一步是普通大模型聊天做不到、必须靠 Agent 的?",
    placeholder: "点名一环:长期记忆、工具调用、固定流程或反馈回路。",
    emptyHint: "选最硬的一环:记忆、工具、流程、反馈,说清为什么非它不可。",
  },
];

/**
 * 第四幕(问题定义 Artifact)的固定文案。
 * 深化不等于解决:缺口原样保留,深化记录只是把追问显性化。
 */
export const artifactCopy = {
  title: "问题定义",
  /** Artifacts 栏注记:第一格已可深化,其余保持预告 */
  railNote: "问题定义可在本页深化;其余 Artifact 在完整流程中逐份沉淀。",
  /** 种子态下第一格入口的名称 */
  startLabel: "深化问题定义",
  /** 深化完成后第一格的常亮名称 */
  litLabel: "问题定义·已深化",
  /** 深化轮维度标签(顺序固定,与种子缺口一一对应) */
  dimensionLabels: ["影响量化", "可观察改善", "Agent 必要一环"],
  counterPrefix: "深化",
  doneTitle: "问题定义",
  doneSubtitle:
    "三幕种子经三轮追问深化而成——缺口仍在,但每一条都有了可继续验证的方向。",
  deepeningLabel: "深化记录",
  deepeningNote: "深化记录来自本次会话回答的摘录,不构成已验证的证据。",
  copyLabel: "复制问题定义",
  backToSeedLabel: "回到问题种子",
} as const;

/**
 * Public Hub privacy boundary. The API never writes a project, but the first
 * two completed scenes may be sent to the server-side AI adapter.
 */
export const coachPrivacyNotice =
  "回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。";

/**
 * 按需隐私确认(Composer B2):常驻小字删除后,仅在选中附件、
 * 内容即将随本轮回答一次性外发时出现;附件不持久化、不写日志。
 */
export const attachmentPrivacyNotice =
  "本轮回答与附件内容将发送至 AI 服务，仅用于本次分析；请勿上传保密、个人或未公开信息。";

/** 三幕完成后问题种子的固定提示文案 */
export const seedCopy = {
  title: "问题种子",
  subtitle: "三幕回答凝结而成的一份草稿——不是项目创建成功,只是值得继续追问的起点。",
  previewNote: `${coachPrivacyNotice} 问题种子只在当前页面会话中凝结，不代表项目已创建或提交。`,
  /* §23 A1:指南页是路径说明而非实践流入口,CTA 只承诺它能兑现的事 */
  cta: { label: "了解完整实践路径", href: "/guide" },
  slots: {
    moment: "想改变的瞬间",
    impact: "影响与损失",
    necessity: "为什么需要 Agent",
  },
  structure: {
    claim: "主张",
    evidence: "证据",
    gaps: "缺口",
  },
  evidenceNote: "以上来自本轮回答的口述信息,尚未接回可核对的运行结果。",
  gapsTitle: "仍待深挖(诚实标注)",
  gaps: [
    "影响面尚未量化——受影响的人数、频次、代价还缺数字",
    "证据尚未接回——改善主张还没有可核对的运行结果",
    "Agent 必要性尚未对照验证——还没有与普通大模型方案的实测对比",
  ],
} as const;

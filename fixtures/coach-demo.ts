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
      judgment: "现在还没有结论,这是好事——从一个具体瞬间开始,比从一个宏大方向开始更接近好作品。",
      risk: "最常见的失败不是做不出来,而是问题本身不够真实:它只存在于设想里,不发生在任何人的某个具体时刻。",
      question: "你最想改变的具体工作瞬间是什么?",
      placeholder: "例如:试验出现异常后,记录、依据和处理结果散落在三处,对不上要来回翻半天……",
      emptyHint: "哪怕先写一句粗糙的也可以——具体到某个时刻、某件事,就够这一幕用。",
    },
    {
      judgment: "瞬间有了,但一个瞬间要成为问题,需要说明它落在谁身上、代价是什么。",
      risk: "如果说不清谁受影响、损失是什么,后面所有技术选择都会失去判断依据。",
      question: "这个问题影响的是谁?损失具体体现在哪里?",
      placeholder: "例如:影响试验工程师和复核人;每次对账多花两小时,版本对不上还会返工……",
      emptyHint: "试着点出具体的人和具体的代价——时间、返工、等待,都算。",
    },
    {
      judgment: "问题与影响逐渐成形。接下来是评委一定会问的一问,现在先问自己。",
      risk: "如果一次普通的大模型对话就能解决,那做成 Agent 反而增加了不必要的复杂度。",
      question: "为什么普通大模型聊天不足以解决它?",
      placeholder: "例如:需要长期记住项目上下文、调用多个信息源、按固定流程多步检查并保留痕迹……",
      emptyHint: "想想:记忆、工具、专业知识、固定流程、多步反馈——它真正需要哪几样?",
    },
  ],
  idea: [
    {
      judgment: "你已经带着方案来了。先不评价功能——评委会先把方案放回问题里检验。",
      risk: "方案先行是最高频的失败路径:功能都做出来了,要解决的问题却讲不具体。",
      question: "先不要描述功能。你观察到的真实问题是什么?",
      placeholder: "例如:想做自动周报助手之前——我观察到的是:每周汇总要手动翻五个系统,还常漏……",
      emptyHint: "把功能放一放,只说你看到的现象:谁、在什么时候、被什么困住。",
    },
    {
      judgment: "现象开始浮现。它要立得住,需要指明落点和代价。",
      risk: "影响面说不清的问题,无法证明被改善,也就无法证明作品的价值。",
      question: "这个问题影响的是谁?怎样算证明了它被改善?",
      placeholder: "例如:影响一线工程师;从“每周约三小时手工汇总”降到“十分钟核对”,就算改善……",
      emptyHint: "给出人和代价,再给一个能观察到的改善信号。",
    },
    {
      judgment: "现在回到你的方案:它必须回答,为什么不是一次聊天就能完成的任务。",
      risk: "如果 Agent 的必要性立不住,已经写好的功能反而会成为负资产。",
      question: "你的方案里,哪一步是普通大模型聊天做不到、必须靠 Agent 的?",
      placeholder: "例如:需要记住历史口径、调用检索和工具、按流程走多步并沉淀结果……",
      emptyHint: "指出方案里非聊天不可的那一环——记忆、工具、流程、反馈,选你最真实的理由。",
    },
  ],
};

/**
 * Public Hub privacy boundary. The API never writes a project, but the first
 * two completed scenes may be sent to the server-side AI adapter.
 */
export const coachPrivacyNotice =
  "回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。";

/** 三幕完成后问题种子的固定提示文案 */
export const seedCopy = {
  title: "问题种子",
  subtitle: "三幕回答凝结而成的一份草稿——不是项目创建成功,只是值得继续追问的起点。",
  previewNote: `${coachPrivacyNotice} 问题种子只在当前页面会话中凝结，不代表项目已创建或提交。`,
  cta: { label: "进入完整实践流程", href: "/guide" },
  restart: "换一条入口重新体验",
  slots: {
    moment: "想改变的瞬间",
    impact: "影响与损失",
    necessity: "为什么需要 Agent",
  },
  gapsTitle: "仍待深挖(诚实标注)",
  gaps: [
    "影响面尚未量化——受影响的人数、频次、代价还缺数字",
    "证据尚未接回——改善主张还没有可核对的运行结果",
  ],
} as const;

/**
 * 站点级配置:品牌、导航、首屏文案、FAQ。
 * 纯数据模块,不得引入服务端依赖(需可被单测与客户端组件直接引用)。
 */
import { activity } from "@/config/activity";

export const site = {
  /** 活动身份只从 config/activity.ts 单向派生，禁止在这里重复维护。 */
  title: activity.identity.name,
  description:
    "一个由 AI Coach 驱动的创新实践入口,帮助青年员工把真实问题逐步变成可构建、可验证、可展示的 AI Agent 作品。",
  positioning:
    "一个由 AI Coach 驱动的创新实践入口,帮助青年员工把真实问题逐步变成可构建、可验证、可展示的 AI Agent 作品。",

  brand: {
    /** 正式 Logo 待授权;获准前使用文字标识 + 中性几何标记(docs/product/03 §7) */
    name: activity.identity.name,
    shortName: activity.identity.shortName,
    tagline: "从一个真实问题开始",
  },

  nav: [
    { label: "问题探索", href: "/" },
    { label: "活动指南", href: "/guide" },
    { label: "参赛者入口", href: "/role/participant" },
  ],
  primaryCta: { label: "开始探索", href: "/" },

  faq: [
    {
      q: "不会编程也可以参加吗?",
      a: "可以。实践路径的前半程是澄清问题、定义价值和判断 Agent 必要性,不要求写代码。实际构建在外部工具中完成,平台负责把任务包准备清楚,并帮你带回证据。",
    },
    {
      q: "已经有一个想法,可以直接开始吗?",
      a: "可以从“我已经有一个想法”入口进入,但 AI Coach 的第一问仍会回到真实问题本身:先不描述功能,先讲你观察到的现象。方案先行是最常见的风险,值得先被检验一次。",
    },
    {
      q: "平台会替我完成 Coding 吗?",
      a: "不会。平台不承担 Coding、在线调试和大规模测试。它负责澄清、沉淀、组织任务包和接回证据;真正的构建在外部工具中完成,这是刻意的边界,不是能力缺口。",
    },
    {
      q: "作品必须与工作相关吗?",
      a: "鼓励从真实工作场景出发,但正式要求(包括团队规则、提交清单与评审维度)以活动正式配置为准。当前页面不预设具体规则。",
    },
    {
      q: "AI Coach 会直接告诉我标准答案吗?",
      a: "不会。Coach 每次只给出当前判断、最大风险和一个关键问题。它严格但建设性,评价和取舍始终留在你手里。",
    },
  ],
} as const;

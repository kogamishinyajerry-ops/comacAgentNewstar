// 游戏化成长线:段位与成就全部由项目真实状态推导(无独立存储,天然防刷)
// 原则:鼓励式有趣——只有"点亮"与"祝贺",没有排名与倒计时压迫。

import type { ProjectProgress } from "./progress";

export interface LevelDef {
  lv: number;
  name: string;
  title: string;
  minPct: number;
  icon: string;
}

export const LEVELS: LevelDef[] = [
  { lv: 1, name: "好奇探索者", title: "迈出了第一步,好奇心是最稀缺的资源", minPct: 0, icon: "🧭" },
  { lv: 2, name: "问题定义者", title: "把模糊的困扰变成了清晰的真问题", minPct: 20, icon: "🎯" },
  { lv: 3, name: "闭环设计师", title: "学会了给AI画边界,给流程装检查", minPct: 40, icon: "🔁" },
  { lv: 4, name: "验证工程师", title: "用证据说话,连失败都如实展示", minPct: 60, icon: "🧪" },
  { lv: 5, name: "轻创实践家", title: "从想法到可验证解法,全程亲手跑通", minPct: 80, icon: "🚀" },
  { lv: 6, name: "解法大师", title: "发现真问题,做出可验证的解法", minPct: 100, icon: "🏆" },
];

export function levelOf(pct: number, submitted: boolean): LevelDef {
  if (submitted) return LEVELS[LEVELS.length - 1];
  const hit = [...LEVELS].reverse().find((l) => pct >= l.minPct);
  return hit ?? LEVELS[0];
}

export function nextLevel(pct: number, submitted: boolean): LevelDef | null {
  if (submitted) return null;
  const cur = levelOf(pct, submitted);
  return LEVELS.find((l) => l.lv === cur.lv + 1) ?? null;
}

/** 当前段位内的进度(0-100),用于XP条 */
export function levelProgress(pct: number, submitted: boolean): number {
  if (submitted) return 100;
  const cur = levelOf(pct, submitted);
  const next = nextLevel(pct, submitted);
  if (!next) return 100;
  return Math.round(((pct - cur.minPct) / (next.minPct - cur.minPct)) * 100);
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  rarity: "common" | "rare" | "epic";
}

export interface AchievementState {
  progress: ProjectProgress;
  teamExists: boolean;
  feedbackCount: number;
  hasSnapshot: boolean;
  submitted: boolean;
  hasDocumentedFailure: boolean;
}

export const ACHIEVEMENTS: (AchievementDef & { check: (s: AchievementState) => boolean })[] = [
  { id: "first-team", name: "集结号", desc: "创建或加入了一支队伍", icon: "🤝", rarity: "common", check: (s) => s.teamExists },
  { id: "rules-keeper", name: "规则守护者", desc: "读完并确认活动规则与数据承诺", icon: "📜", rarity: "common", check: (s) => s.progress.steps[0].status === "done" },
  { id: "truth-seeker", name: "真问题捕手", desc: "完整描述了目标用户、场景与代价", icon: "🎯", rarity: "common", check: (s) => s.progress.steps[3].status === "done" },
  { id: "standard-setter", name: "立宪者", desc: "写清了什么算可用、什么不可接受", icon: "⚖️", rarity: "rare", check: (s) => s.progress.steps[4].status === "done" },
  { id: "loop-master", name: "闭环掌控者", desc: "求证闭环五要素集齐——红线变铠甲", icon: "🛡️", rarity: "epic", check: (s) => s.progress.closedLoopOk && s.progress.steps[5].status === "done" },
  { id: "boundary-artist", name: "边界画师", desc: "AI与人的分工边界绘制完成", icon: "✏️", rarity: "rare", check: (s) => s.progress.steps[5].status === "done" },
  { id: "first-diagnosis", name: "初次对话", desc: "第一次与专职Agent深度对话", icon: "💬", rarity: "common", check: (s) => s.feedbackCount > 0 },
  { id: "five-tests", name: "五连测试", desc: "5个测试案例,三类覆盖齐全", icon: "🧪", rarity: "rare", check: (s) => s.progress.tests.passOk && s.progress.tests.coverageOk },
  { id: "failure-honest", name: "如实以告", desc: "展示了失败案例并写清原因——勇气的证明", icon: "🦁", rarity: "epic", check: (s) => s.hasDocumentedFailure },
  { id: "precheck-pass", name: "预检通关", desc: "硬规则校验全部通过,可以提交了", icon: "✅", rarity: "rare", check: (s) => s.hasSnapshot },
  { id: "submitted", name: "解法成立", desc: "作品已提交,快照不可变,这是你的里程碑", icon: "🏆", rarity: "epic", check: (s) => s.submitted },
];

export function evaluateAchievements(s: AchievementState): AchievementDef[] {
  return ACHIEVEMENTS.filter((a) => a.check(s)).map(({ check, ...def }) => def);
}

export const RARITY_LABEL: Record<AchievementDef["rarity"], string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
};

export const RARITY_RING: Record<AchievementDef["rarity"], string> = {
  common: "ring-slate-200 bg-slate-50",
  rare: "ring-blue-200 bg-blue-50",
  epic: "ring-amber-300 bg-gradient-to-br from-amber-50 to-orange-50",
};

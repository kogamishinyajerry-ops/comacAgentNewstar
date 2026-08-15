// 插画场景资产表:图鉴收集册与生成提示词共用

export interface ArtSceneDef {
  scene: string;
  label: string;
  icon: string;
}

/** 项目维度的收集场景(图鉴共8格) */
export const PROJECT_ART_SCENES: ArtSceneDef[] = [
  { scene: "step-4", label: "真问题被捕获", icon: "🎯" },
  { scene: "step-5", label: "判定标准立宪", icon: "⚖️" },
  { scene: "step-6", label: "人机边界初成", icon: "✏️" },
  { scene: "step-8", label: "五连测试成军", icon: "🧪" },
  { scene: "ach-loop-master", label: "史诗·闭环掌控者", icon: "🛡️" },
  { scene: "ach-failure-honest", label: "史诗·如实以告", icon: "🦁" },
  { scene: "ach-submitted", label: "史诗·解法成立", icon: "🏆" },
  { scene: "submit", label: "提交纪念", icon: "📜" },
];

/** 全局每日灵感(无需登录,按日缓存) */
export function dailyScene(now = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `daily-${d}`;
}

export function isDailyScene(scene: string): boolean {
  if (!/^daily-\d{4}-\d{2}-\d{2}$/.test(scene)) return false;
  const d = new Date(scene.slice(6) + "T12:00:00Z");
  if (Number.isNaN(d.getTime())) return false;
  const diff = Math.abs(Date.now() - d.getTime()) / 86400000;
  return diff <= 1.5;
}

/** 每日灵感语录(按日期轮换) */
export const DAILY_QUOTES: string[] = [
  "最好的问题,往往藏在\"为什么每周都要重复做这件事\"里。",
  "先让一个人受益,再谈改变世界。",
  "失败案例不是污点,是你求证闭环存在的证据。",
  "AI负责重复,你负责判断——边界画得越清,解法越稳。",
  "小到不能再小的闭环,也好过宏大而空泛的计划。",
  "把判定标准写成一句话:什么算\"对了\"?",
  "今天填的每一个字段,都是评审那天的证据。",
];

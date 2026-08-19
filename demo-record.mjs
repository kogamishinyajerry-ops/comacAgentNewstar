/**
 * 第四幕问题定义 Artifact — 实机全链路录屏脚本(§28 演示用,不参与构建)。
 * 真实浏览器 + 真实 GLM 出站(.env LLM_MOCK_MODE=false 的 dev 服务):
 * /start → 三幕一问一答 → 问题种子 → 三轮深化 → 问题定义卡 → 复制导出 → 回种子闭环。
 * 等待信号全部用状态标记(data-phase / data-artifact-*),不依赖 live 文案。
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = "demo-recordings";
mkdirSync(OUT_DIR, { recursive: true });

const ACT_ANSWERS = [
  "试验异常记录分散在三处，对账要来回翻找",
  "影响试验工程师与复核人，每次对账约多花两小时",
  "需要记住项目口径，按固定流程调用检索工具逐步核对并留痕",
];
const DEEPENING_ANSWERS = [
  "大约四十名试验工程师，每周对账三次，每次多花约两小时",
  "对账时长从两小时降到半小时，且不再出现漏找依据的返工",
  "必须按固定流程调用检索工具并逐步留痕，普通对话记不住口径也不留痕",
];

const t0 = Date.now();
const log = (msg) => console.log(`[demo +${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const context = await browser.newContext({
  viewport: { width: 1536, height: 960 },
  locale: "zh-CN",
  recordVideo: { dir: OUT_DIR, size: { width: 1536, height: 960 } },
});
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
const page = await context.newPage();
page.setDefaultTimeout(120_000);
page.on("pageerror", (err) => log(`⚠️ pageerror: ${err.message}`));

const questionHeading = page.locator("#coach-question");
const transitionPhase = page.locator('div[data-phase="transition"]');
const questionPhase = page.locator('div[data-phase="question"]');
const composer = page.locator("#coach-answer");

async function readQuestion() {
  return (await questionHeading.textContent())?.trim();
}

async function typeAnswer(text) {
  await composer.click();
  await composer.pressSequentially(text, { delay: 45 });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
  log("已提交，等待 Coach 过渡……");
  await transitionPhase.waitFor({ timeout: 30_000 });
}

async function waitForNextQuestion() {
  await questionPhase.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1200);
  log(`下一问：${await readQuestion()}`);
}

/* ── 进入问题探索 ─────────────────────────────── */
log("打开 /start（问题探索）");
await page.goto(`${BASE}/start`);
await page.waitForLoadState("domcontentloaded");
await questionPhase.waitFor();
await page.waitForTimeout(2500);
log(`第一幕问题：${await readQuestion()}（右侧问题卡三格幽灵槽在场）`);

/* ── 三幕：一幕一问一答（第2、3幕内容为真实 GLM 生成） ── */
for (const [i, answer] of ACT_ANSWERS.entries()) {
  await typeAnswer(answer);
  /* 打磨轮⑥:第一幕等待期展示回看抽屉(全文问答+当前行) */
  if (i === 0) {
    await page.waitForTimeout(2500);
    await page.locator("[data-coach-review-trigger]").click();
    log("GLM 等待期打开回看抽屉");
    await page.waitForTimeout(3200);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
  }
  if (i < 2) {
    await waitForNextQuestion();
  } else {
    /* 末幕客户端凝结，不再请求模型 */
    await page.getByText("问题种子", { exact: true }).waitFor();
    log("三幕完成，问题种子已凝结");
  }
}
await page.waitForTimeout(2000);

/* ── 种子态 → Artifacts 第一格入口 ─────────────── */
await page.locator("[data-artifact-entry]").waitFor();
log("种子态可见，点击 Artifacts 第一格（问题定义入口）");
await page.waitForTimeout(1200);
await page.locator("[data-artifact-entry]").click();

/* ── 三轮深化：第1、2轮真实 GLM 出站，末轮客户端凝结 ── */
for (const [round, answer] of DEEPENING_ANSWERS.entries()) {
  await questionPhase.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  log(`深化第 ${round + 1} 轮问题：${await readQuestion()}`);
  await typeAnswer(answer);
  if (round < 2) {
    await transitionPhase.waitFor({ timeout: 30_000 });
    await questionPhase.waitFor({ timeout: 120_000 });
  }
}

/* ── 问题定义卡：确定性凝结 ───────────────────── */
await page.locator("[data-artifact-card]").waitFor();
/* 入场凝结动效(§25):等透明度落定再开始阅读展示 */
await page.locator("[data-artifact-card]").evaluate((el) => new Promise((resolve) => {
  const timer = setInterval(() => {
    if (getComputedStyle(el).opacity === "1") {
      clearInterval(timer);
      resolve();
    }
  }, 150);
}));
await page.waitForTimeout(2000);
log("问题定义卡已凝结，开始逐块阅读");

/* 逐块停留滚动展示：论断/证据/深化记录/缺口 */
for (let step = 0; step < 6; step += 1) {
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(900);
}
log(`深化记录条目数：${await page.locator("[data-artifact-deepening-item]").count()}`);

/* ── 复制导出（浏览器本地剪贴板写入） ──────────── */
await page.getByRole("button", { name: "复制问题定义" }).scrollIntoViewIfNeeded();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "复制问题定义" }).click();
await page.locator("[data-artifact-copy-status]").waitFor();
const copyStatus = (await page.locator("[data-artifact-copy-status]").textContent())?.trim();
log(`复制状态：${copyStatus}`);
const exported = await page.evaluate(() => navigator.clipboard.readText());
writeFileSync(`${OUT_DIR}/问题定义导出.txt`, exported, "utf8");
log(`导出文本 ${exported.length} 字已存 ${OUT_DIR}/问题定义导出.txt`);
await page.waitForTimeout(1500);

/* ── 卡态侧栏：第一格常亮「问题定义·已深化」 ───── */
await page.locator("[data-artifact-lit]").waitFor();
log("卡态侧栏第一格已常亮（问题定义·已深化）");
await page.waitForTimeout(1500);

/* ── 终态回看：五轮全文一屏尽收 ────────────────── */
await page.locator("[data-coach-review-trigger]").click();
await page.locator("[data-coach-review]").waitFor();
log("终态回看抽屉:三幕+三轮深化全文在场");
await page.waitForTimeout(2800);
await page.keyboard.press("Escape");
await page.waitForTimeout(900);

/* ── 回种子闭环：进度保留，再入直达卡 ──────────── */
await page.getByRole("button", { name: "← 回到问题种子" }).click();
await page.getByText("问题种子", { exact: true }).waitFor();
await page.locator("[data-artifact-entry]").waitFor();
log("已安静回到种子：深化进度保留在会话内");
await page.waitForTimeout(1800);
await page.locator("[data-artifact-entry]").click();
await page.locator("[data-artifact-card]").waitFor();
log("再入直达问题定义卡 — 全链路闭环完成");
await page.waitForTimeout(2500);

await context.close();
await page.video().saveAs(`${OUT_DIR}/第四幕全链路-live.webm`);
await browser.close();
log(`录屏已保存：${OUT_DIR}/第四幕全链路-live.webm`);

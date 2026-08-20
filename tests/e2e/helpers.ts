import { expect, type Page } from "@playwright/test";
import { coachDemoArtifactActs } from "../../fixtures/coach-demo";

/**
 * e2e 共用助手(旅程叙事轮 §31):建立拍 click-through 与三幕/深化流程收敛。
 * 各 spec 里重复的"goto → 三幕 → 种子"循环统一走这里,保持 spec 本体只写断言。
 */

/** 三幕固定问题(真实问题入口,与 fixtures 确定性文案一致) */
export const ACT_QUESTIONS = [
  "你最想改变的具体工作瞬间是什么？",
  "这个问题对谁造成了什么具体损失？",
  "为什么普通大模型聊天不足以解决它？",
] as const;

export const ACT_ANSWERS = [
  "试验异常记录分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

export const DEEPENING_ANSWERS = [
  "大约四十名试验工程师,每周对账三次,每次多花约两小时",
  "对账时长从两小时降到半小时,且不再出现漏找依据的返工",
  "必须按固定流程调用检索工具并逐步留痕,普通对话记不住口径也不留痕",
] as const;

/**
 * 建立拍(J-1)click-through,幂等:
 * - 「开始第一问」在场(phase === "intro")→ 点击并等回答器端上;
 * - 不在场(已进入问题态/过渡态/种子态)→ 直接返回。
 * 点击包在 toPass 里:hydration 未完成时的首次点击自动重试,不放大抖动。
 */
export async function beginCoach(page: Page): Promise<void> {
  const begin = page.locator("[data-coach-begin]");
  // 换入口/重挂载后建立拍可能晚几百毫秒端上:先等"建立拍或回答器"任一可见
  await page
    .locator("[data-coach-begin], #coach-answer")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
  if ((await begin.count()) === 0) return;
  await expect(async () => {
    if ((await page.locator("#coach-answer").count()) === 0) {
      await begin.click();
    }
    await expect(page.locator("#coach-answer")).toBeVisible();
  }).toPass({ timeout: 15_000 });
}

/** 填写并提交当前幕/当前深化轮的回答 */
export async function submitCoachAnswer(page: Page, answer: string): Promise<void> {
  await page.locator("#coach-answer").fill(answer);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
}

/** 从 /start 建立拍开始走完三幕,直到问题种子凝结 */
export async function completeThreeActs(page: Page): Promise<void> {
  await page.goto("/start");
  await beginCoach(page);
  for (const [index, question] of ACT_QUESTIONS.entries()) {
    await expect(page.getByRole("heading", { name: question })).toBeVisible({
      timeout: 15_000,
    });
    await submitCoachAnswer(page, ACT_ANSWERS[index]);
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** 走完三幕后进入第四幕,三轮深化直到问题定义卡凝结 */
export async function completeArtifact(page: Page): Promise<void> {
  await completeThreeActs(page);
  await page.locator("[data-artifact-entry]").click();
  for (const [round, act] of coachDemoArtifactActs.entries()) {
    await expect(page.getByRole("heading", { name: act.question })).toBeVisible({
      timeout: 15_000,
    });
    await submitCoachAnswer(page, DEEPENING_ANSWERS[round]);
  }
  await expect(page.locator("[data-artifact-card]")).toBeVisible({ timeout: 15_000 });
}

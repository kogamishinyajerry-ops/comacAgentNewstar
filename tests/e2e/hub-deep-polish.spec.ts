import { expect, test } from "@playwright/test";
import { site } from "../../config/site";
import { beginCoach } from "./helpers";

const FIRST_QUESTION = "你最想改变的具体工作瞬间是什么?";
const SECOND_QUESTION = "这个问题对谁造成了什么具体损失?";

/**
 * 深度优化回归：根入口先说明活动与路径，但不把用户挡在营销页；
 * 第一问只留极弱种子轨，首份回答沉淀后问题卡才完整长出。
 * 旅程叙事轮(§31):首屏是建立拍——在场确认后 begin,再断言第一问与种子轨。
 */
test.describe("Hub 冷启动与渐进工作空间", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("根入口同时完成活动定向与一问一幕，不增加第二个主标题", async ({ page }) => {
    await page.goto("/");

    const orientation = page.locator("[data-hub-orientation]");
    await expect(orientation).toBeVisible();
    await expect(orientation).toContainText("把一个真实问题，变成可验证的 Agent 作品");
    await expect(orientation).toContainText("三幕追问后凝结问题种子");
    await expect(orientation).toContainText("外部构建并带回证据");
    await expect(orientation.getByRole("link", { name: /活动如何进行/ })).toHaveAttribute(
      "href",
      "/guide",
    );

    const art = orientation.locator('img[src*="hub-hero-cognitive-canvas"]');
    await expect(art).toBeVisible();
    expect(await art.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThanOrEqual(800);

    // 建立拍在场:唯一 CTA 是「开始第一问」,小卡与回答器此拍不渲染
    await expect(page.locator("[data-coach-intro]")).toBeVisible();
    await expect(page.locator("[data-coach-begin]")).toBeVisible();
    await expect(page.locator("[data-coach-progress]")).toHaveCount(0);
    await expect(page.locator("#coach-answer")).toHaveCount(0);
    await beginCoach(page);

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  });

  test("空问题卡先收成窄轨，回答沉淀后再完整长出", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    const progress = page.locator("[data-coach-progress]");
    await expect(progress).toBeVisible();

    const initialWidth = await progress.evaluate((element) => element.getBoundingClientRect().width);
    expect(initialWidth).toBeLessThanOrEqual(90);

    await page.locator("#coach-answer").fill("试验异常记录分散在三处，对账时需要反复翻找依据。");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(page.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible({
      timeout: 15_000,
    });

    const expandedWidth = await progress.evaluate((element) => element.getBoundingClientRect().width);
    expect(expandedWidth).toBeGreaterThanOrEqual(280);
    await expect(page.locator('[data-coach-slot="moment"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
  });

  test("/start 保持纯 Coach 场景，适合已理解活动的用户直接进入", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator("[data-hub-orientation]")).toHaveCount(0);
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
    await expect(page.locator("#coach-answer")).toBeVisible();
  });
});

test("390×844：定向层压缩后无横向或页面级纵向溢出", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const orientation = page.locator("[data-hub-orientation]");
  await expect(orientation).toBeVisible();
  await expect(orientation.getByText(site.brand.name, { exact: true })).toBeVisible();
  await expect(page.locator("[data-hub-orientation-mobile-summary]")).toContainText(
    "直接回答 → 三幕追问 → 问题种子 → 外部构建与证据",
  );

  // 建立拍同样满足固定视口宪法:零横向溢出且一屏放得下
  const introGeometry = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(introGeometry.horizontal).toBeLessThanOrEqual(0);
  expect(introGeometry.documentHeight).toBeLessThanOrEqual(introGeometry.viewportHeight + 1);

  await beginCoach(page);
  const progress = page.locator("[data-coach-progress]");
  const scene = page.locator(".coach-workspace-dialog");
  const progressBox = await progress.boundingBox();
  const sceneBox = await scene.boundingBox();
  expect(progressBox?.height).toBeLessThanOrEqual(64);
  expect(progressBox?.width).toBeGreaterThanOrEqual(350);
  expect(sceneBox?.width).toBeGreaterThanOrEqual(350);
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await expect(page.locator("#coach-answer")).toBeVisible();

  const geometry = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(geometry.horizontal).toBeLessThanOrEqual(0);
  expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
});

test("1024×768：第一问仍是 68px 种子轨，回答后才展开问题卡", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await beginCoach(page);

  const progress = page.locator("[data-coach-progress]");
  const initialBox = await progress.boundingBox();
  expect(initialBox?.width).toBeLessThanOrEqual(90);
  await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  await expect(page.locator("#coach-answer")).toBeVisible();

  await page.locator("#coach-answer").fill("试验异常记录分散在三处，对账时需要反复翻找依据。");
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
  await expect(page.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible({
    timeout: 15_000,
  });

  const expandedBox = await progress.boundingBox();
  expect(expandedBox?.width).toBeGreaterThanOrEqual(280);
});

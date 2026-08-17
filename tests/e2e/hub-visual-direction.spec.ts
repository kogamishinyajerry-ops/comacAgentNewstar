import { expect, test } from "@playwright/test";

const VISUAL_SHOTS = "docs/screenshots/fixed-workbench";

test.describe("Hub 单屏 Coach 工作台视觉方向", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("页面本身固定在视口内，只有会话记录区允许纵向滚动", async ({ page }) => {
    await page.goto("/");

    const geometry = await page.evaluate(() => {
      const workbench = document.querySelector<HTMLElement>("[data-coach-workbench]");
      const conversation = document.querySelector<HTMLElement>("[data-coach-conversation-scroll]");
      if (!workbench || !conversation) throw new Error("Coach workbench landmarks missing");
      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        workbenchBottom: workbench.getBoundingClientRect().bottom,
        conversationOverflowY: getComputedStyle(conversation).overflowY,
        footerVisible: Boolean(document.querySelector<HTMLElement>(".hub-footer")?.getClientRects().length),
      };
    });

    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.workbenchBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    expect(geometry.conversationOverflowY).toBe("auto");
    expect(geometry.footerVisible).toBe(false);

    await page.screenshot({ path: `${VISUAL_SHOTS}/home-1440.png`, fullPage: false });
  });

  test("五种 Coach 状态使用高分辨率平面资产且没有媒体旁白", async ({ page }) => {
    await page.goto("/");

    const activeArt = page.locator('img[data-coach-art="flat"]').first();
    await expect(activeArt).toBeVisible();
    expect(await activeArt.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThanOrEqual(1024);
    await expect(page.locator(".coach-orb svg")).toHaveCount(0);
    await expect(page.locator("audio, video")).toHaveCount(0);
  });
});

test.describe("单屏工作台窄桌面", () => {
  test.use({ viewport: { width: 916, height: 800 } });

  test("916px 视口没有页面级横向或纵向溢出", async ({ page }) => {
    await page.goto("/");
    const geometry = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(geometry.horizontal).toBeLessThanOrEqual(0);
    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    await page.screenshot({ path: `${VISUAL_SHOTS}/home-916.png`, fullPage: false });
  });
});

test.describe("单屏工作台移动端", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("390px 视口把入口与状态压缩到顶部，仍只有会话区滚动", async ({ page }) => {
    await page.goto("/");
    const geometry = await page.evaluate(() => {
      const conversation = document.querySelector<HTMLElement>("[data-coach-conversation-scroll]");
      if (!conversation) throw new Error("Coach conversation landmark missing");
      return {
        horizontal: document.documentElement.scrollWidth - window.innerWidth,
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        conversationOverflowY: getComputedStyle(conversation).overflowY,
      };
    });
    expect(geometry.horizontal).toBeLessThanOrEqual(0);
    expect(geometry.documentHeight).toBeLessThanOrEqual(geometry.viewportHeight + 1);
    expect(geometry.conversationOverflowY).toBe("auto");
    await page.screenshot({ path: `${VISUAL_SHOTS}/home-390.png`, fullPage: false });
  });
});

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

  test("五种 Coach 状态由纯代码 orb 表达、视觉可区分且没有媒体旁白", async ({ page }) => {
    // 纯代码视觉方向(2026-08-20 授权):不依赖插入的美术素材,orb 五态由
    // 光晕/conic 弧环/刻线/核心/勾选逐层绘制,.coach-orb 内零 svg 零 img。
    await page.goto("/dev/scenarios");

    const orb = page.locator('.coach-orb[data-coach-mark="scenarios-orb"]');
    await expect(orb).toBeVisible();
    await expect(orb.locator("svg")).toHaveCount(0);
    await expect(orb.locator("img")).toHaveCount(0);

    const readSignature = () =>
      orb.evaluate((el) =>
        Array.from(el.querySelectorAll("span"))
          .map((span) => {
            const style = getComputedStyle(span);
            return `${style.opacity}|${style.transform}|${style.backgroundImage}|${style.borderColor}`;
          })
          .join(";"),
      );

    const states = ["idle", "listening", "challenging", "condensing", "confirmed"] as const;
    const signatures = new Map<string, string>();
    for (const state of states) {
      await page.locator(`input[name="orb-state"][value="${state}"]`).check();
      await expect(orb).toHaveAttribute("data-state", state);
      // 态间过渡 540ms,等过渡落定再读静态画面签名
      await page.waitForTimeout(700);
      signatures.set(state, await readSignature());
    }
    // 五态视觉两两可区分
    expect(new Set(signatures.values()).size).toBe(states.length);

    await page.goto("/");
    await expect(page.locator(".coach-orb").first()).toBeVisible();
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

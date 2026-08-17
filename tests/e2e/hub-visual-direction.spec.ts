import { expect, test } from "@playwright/test";

const VISUAL_SHOTS = "docs/screenshots/flat-atlas";

test.describe("Hub 平面证据图谱视觉方向", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("首页是连续长卷，首屏露出下一章节而非整屏幻灯片", async ({ page }) => {
    await page.goto("/");

    const geometry = await page.evaluate(() => {
      const hero = document.querySelector<HTMLElement>("[data-hub-hero]");
      const firstChapter = document.querySelector<HTMLElement>("#intro");
      if (!hero || !firstChapter) throw new Error("Hub visual landmarks missing");
      return {
        documentHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        heroHeight: hero.getBoundingClientRect().height,
        firstChapterTop: firstChapter.getBoundingClientRect().top,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    });

    expect(geometry.documentHeight).toBeGreaterThan(geometry.viewportHeight * 5);
    expect(geometry.heroHeight).toBeLessThan(geometry.viewportHeight * 0.9);
    expect(geometry.firstChapterTop).toBeLessThan(geometry.viewportHeight);
    expect(geometry.overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${VISUAL_SHOTS}/home-full-1440.png`, fullPage: true });
  });

  test("核心视觉使用高分辨率平面资产，Coach 不再渲染 3D 光核 SVG", async ({ page }) => {
    await page.goto("/");

    const heroArt = page.locator('img[data-coach-art="flat"]').first();
    await expect(heroArt).toBeVisible();
    expect(decodeURIComponent((await heroArt.getAttribute("src")) ?? "")).toContain(
      "/hub/art/flat-coach-field.png"
    );
    expect(await heroArt.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThanOrEqual(1024);

    await page.locator("#coach-preview").scrollIntoViewIfNeeded();
    await expect(page.locator('#coach-preview img[data-coach-art="flat"]')).toBeVisible();
    await expect(page.locator(".coach-orb svg")).toHaveCount(0);
    await expect(page.locator("audio, video")).toHaveCount(0);
  });
});

test.describe("Evidence Atlas 视觉真值宽度", () => {
  test.use({ viewport: { width: 916, height: 800 } });

  test("916px 对照截图无横向溢出", async ({ page }) => {
    await page.goto("/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    ).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `${VISUAL_SHOTS}/home-full-916.png`, fullPage: true });
  });
});

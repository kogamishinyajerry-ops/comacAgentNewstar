import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const desktop = { width: 1440, height: 900 };
const tablet = { width: 1024, height: 768 };
const mobile = { width: 390, height: 844 };

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("Hub 无障碍与响应式深化", () => {
  test("1024×768: 无横向溢出，首屏 CTA 可见且可用", async ({ page }) => {
    await page.setViewportSize(tablet);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "把一个真实问题,变成可验证的 AI Agent 作品" })
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开导航菜单" })).toHaveCount(0);
    await expect(page.locator(".hub-brand img")).toHaveCount(0);
    const primaryCta = page.getByRole("link", { name: "从一个真实问题开始" });
    await expect(primaryCta).toBeVisible();

    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      ctaBottom: document.querySelector<HTMLAnchorElement>('a[href="/start"]')?.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.ctaBottom).toBeLessThanOrEqual(metrics.viewportHeight);
    await expect(page.getByRole("link", { name: "组件与动效验收页" })).toHaveCount(0);

    await page.goto("/start");
    await expect(page.locator("#coach-answer")).toBeVisible();
    const coachOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(coachOverflow).toBeLessThanOrEqual(0);
  });

  test("跳过链接将键盘焦点交给主要内容", async ({ page }) => {
    await page.setViewportSize(desktop);
    await page.goto("/");

    const skipLink = page.getByRole("link", { name: "跳到主要内容" });
    await page.keyboard.press("Tab");
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#hub-main")).toBeFocused();
  });

  test("移动端抽屉从具名关闭按钮开始锁焦，并在 Esc 后归还焦点", async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto("/");

    const burger = page.getByRole("button", { name: "打开导航菜单" });
    await burger.focus();
    await page.keyboard.press("Enter");

    const drawer = page.locator("#hub-drawer");
    const close = drawer.getByRole("button", { name: "关闭导航菜单" });
    const drawerCta = drawer.getByRole("link", { name: "开始探索" });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(close).toBeFocused();

    for (const label of ["活动介绍", "实践路径", "不同角色", "常见问题", "开始探索"]) {
      await page.keyboard.press("Tab");
      await expect(drawer.getByRole("link", { name: label })).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect(drawerCta).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
    await expect(burger).toBeFocused();
  });

  test("减弱动态时关闭 Hub 动效与平滑滚动，信息仍可见", async ({ page }) => {
    await page.setViewportSize(desktop);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "把一个真实问题,变成可验证的 AI Agent 作品" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "从一个真实问题开始" })).toBeVisible();

    const motion = await page.locator(".hub-btn").first().evaluate((button) => ({
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: getComputedStyle(button).transitionDuration,
      animationName: getComputedStyle(button).animationName,
    }));
    expect(motion.scrollBehavior).toBe("auto");
    expect(motion.transitionDuration).toBe("0s");
    expect(motion.animationName).toBe("none");
  });

  test("移动端低强调链接保留 44px 触控热区", async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto("/");

    const quietLink = page.getByRole("link", { name: "先了解活动如何进行" });
    const height = await quietLink.evaluate((link) => link.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(44);
  });

  test("默认待确认配置不伪造外部报名入口或 Logo", async ({ page }) => {
    await page.setViewportSize(desktop);
    await page.goto("/guide");

    await expect(page.getByText("待活动配置确认").first()).toBeVisible();
    await expect(page.locator('a[href^="https://"]')).toHaveCount(0);
    await expect(page.locator(".hub-brand img")).toHaveCount(0);
  });
});

const axeCases = [
  { name: "首页桌面", url: "/", viewport: desktop },
  { name: "Coach 起始幕平板", url: "/start", viewport: tablet },
  { name: "活动指南移动端", url: "/guide", viewport: mobile },
  { name: "参赛者角色页桌面", url: "/role/participant", viewport: desktop },
  { name: "评委角色页平板", url: "/role/reviewer", viewport: tablet },
  { name: "组织者角色页移动端", url: "/role/organizer", viewport: mobile },
] as const;

for (const axeCase of axeCases) {
  test(`Axe: ${axeCase.name} 无自动化可检测违规`, async ({ page }) => {
    await page.setViewportSize(axeCase.viewport);
    await page.goto(axeCase.url);
    await expect(page.locator("#hub-main")).toBeVisible();
    await expectNoAxeViolations(page);
  });
}

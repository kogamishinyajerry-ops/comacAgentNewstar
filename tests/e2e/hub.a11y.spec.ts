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
  test("1024×768: 无页面级溢出，Coach 回答器可见且可用", async ({ page }) => {
    await page.setViewportSize(tablet);
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "你最想改变的具体工作瞬间是什么?" })
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "主导航" })).toBeVisible();
    await expect(page.getByRole("button", { name: "打开导航菜单" })).toHaveCount(0);
    await expect(page.locator(".hub-brand img")).toHaveCount(0);
    const switchEntry = page.getByRole("link", { name: /换一条入口/ });
    await expect(switchEntry).toBeVisible();

    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      composerBottom: document.querySelector(".coach-composer")?.getBoundingClientRect().bottom,
      viewportHeight: window.innerHeight,
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.composerBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
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
    // 首页不再渲染头部 CTA(§21:工作台页 CTA 自指且会丢进度),抽屉闭环在 /guide 验证
    await page.goto("/guide");

    const burger = page.getByRole("button", { name: "打开导航菜单" });
    await burger.focus();
    await page.keyboard.press("Enter");

    const drawer = page.locator("#hub-drawer");
    const close = drawer.getByRole("button", { name: "关闭导航菜单" });
    const drawerCta = drawer.getByRole("link", { name: "开始探索" });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(close).toBeFocused();

    // 几何断言:抽屉必须相对视口铺到 header 以下全高。
    // 旧断言只查 data-open/aria-hidden 属性与焦点,不含任何布局信息;
    // header 的 backdrop-filter 曾把抽屉包含块改写为 header,
    // 使抽屉塌陷为 390×64 而属性断言全部照过,因此必须实测几何。
    const geometry = await drawer.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        top: rect.top,
        height: rect.height,
        width: rect.width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(56);
    expect(geometry.top).toBeLessThanOrEqual(72);
    expect(geometry.height).toBeGreaterThanOrEqual(geometry.viewportHeight - 80);
    expect(geometry.width).toBe(geometry.viewportWidth);

    for (const label of ["问题探索", "活动指南", "参赛者入口", "开始探索"]) {
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
    // 首页无 .hub-btn(§21 首页隐藏 CTA);guide 次级按钮承载同一动效断言
    await page.goto("/guide");

    await expect(page.getByRole("heading", { name: "你的下一步" })).toBeVisible();

    const motion = await page.locator(".hub-btn").first().evaluate((button) => ({
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: getComputedStyle(button).transitionDuration,
      animationName: getComputedStyle(button).animationName,
    }));
    expect(motion.scrollBehavior).toBe("auto");
    expect(motion.transitionDuration).toBe("0s");
    expect(motion.animationName).toBe("none");
  });

  test("移动端弱化换入口保留 44px 触控热区", async ({ page }) => {
    await page.setViewportSize(mobile);
    await page.goto("/");

    const quietLink = page.getByRole("link", { name: /换一条入口/ });
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

/* K3 增补:过渡后问题态与种子态也必须零豁免(任务书§七) */
const ACT_AXE_QUESTIONS = [
  "你最想改变的具体工作瞬间是什么?",
  "这个问题对谁造成了什么具体损失?",
  "为什么普通大模型聊天不足以解决它?",
] as const;

const ACT_AXE_ANSWERS = [
  "试验异常记录、依据和处理结果分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

test("Axe: 过渡后问题态(第二幕)无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/start");
  await page.locator("#coach-answer").fill(ACT_AXE_ANSWERS[0]);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
  await expect(
    page.getByRole("heading", { name: "这个问题对谁造成了什么具体损失?" })
  ).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(page);
});

test("Axe: 问题种子态无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/start");
  for (const [index, answer] of ACT_AXE_ANSWERS.entries()) {
    await expect(
      page.getByRole("heading", { name: ACT_AXE_QUESTIONS[index] })
    ).toBeVisible();
    await page.locator("#coach-answer").fill(answer);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(page);
});

test("Axe: 问题种子态(移动端 390×844)无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto("/start");
  for (const [index, answer] of ACT_AXE_ANSWERS.entries()) {
    await expect(
      page.getByRole("heading", { name: ACT_AXE_QUESTIONS[index] })
    ).toBeVisible();
    await page.locator("#coach-answer").fill(answer);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(page);
});

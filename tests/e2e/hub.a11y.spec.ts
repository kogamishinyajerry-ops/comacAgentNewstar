import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { beginCoach } from "./helpers";

const desktop = { width: 1440, height: 900 };
const tablet = { width: 1024, height: 768 };
const mobile = { width: 390, height: 844 };

const ATTACH_LABEL = "添加文本附件（.txt/.md/.csv/.json，≤1MB）";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

/** 通过附件按钮唤起原生文件选择器并注入内存文件(与 composer spec 同法) */
async function chooseAttachmentFile(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer }
) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: ATTACH_LABEL, exact: true }).click(),
  ]);
  await chooser.setFiles(file);
}

test.describe("Hub 无障碍与响应式深化", () => {
  test("1024×768: 无页面级溢出，Coach 回答器可见且可用", async ({ page }) => {
    await page.setViewportSize(tablet);
    await page.goto("/");
    await beginCoach(page);

    await expect(
      page.getByRole("heading", { name: "你最想改变的具体工作瞬间是什么？" })
    ).toBeVisible();
    /* §33 K1:工作台页站点导航不渲染(主导航/burger/品牌图都不在场) */
    await expect(page.getByRole("navigation", { name: "主导航" })).toHaveCount(0);
    await expect(page.locator(".hub-header")).toHaveCount(0);
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
    await beginCoach(page);
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

  test("移动端抽屉从首个导航链接开始锁焦，并在 Esc 后归还焦点", async ({ page }) => {
    await page.setViewportSize(mobile);
    // 首页不再渲染头部 CTA(§21:工作台页 CTA 自指且会丢进度),抽屉闭环在 /guide 验证
    await page.goto("/guide");

    const burger = page.getByRole("button", { name: "打开导航菜单" });
    await burger.focus();
    await page.keyboard.press("Enter");

    const drawer = page.locator("#hub-drawer");
    /* 走查修复轮:抽屉内独立的「关闭导航菜单」按钮已移除,关闭由汉堡 X / Esc 承担;
       初始焦点落在首个导航链接(hub-header.tsx data-drawer-initial-focus 契约) */
    const firstLink = drawer.getByRole("link", { name: "问题探索" });
    const drawerCta = drawer.getByRole("link", { name: "开始探索" });
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await expect(firstLink).toBeFocused();

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

    for (const label of ["活动指南", "参赛者入口", "开始探索"]) {
      await page.keyboard.press("Tab");
      await expect(drawer.getByRole("link", { name: label })).toBeFocused();
    }
    // 末位 CTA 再 Tab:焦点回绕到首个导航链接
    await page.keyboard.press("Tab");
    await expect(firstLink).toBeFocused();

    // 首位 Shift+Tab:焦点回绕到末位 CTA,再 Tab 回到首位
    await page.keyboard.press("Shift+Tab");
    await expect(drawerCta).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(firstLink).toBeFocused();

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
    // 换一条入口在第一幕问题态渲染,建立拍只有返回指南出口
    await beginCoach(page);

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
  "你最想改变的具体工作瞬间是什么？",
  "这个问题对谁造成了什么具体损失？",
  "为什么普通大模型聊天不足以解决它？",
] as const;

const ACT_AXE_ANSWERS = [
  "试验异常记录、依据和处理结果分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

test("Axe: 过渡后问题态(第二幕)无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/start");
  await beginCoach(page);
  await page.locator("#coach-answer").fill(ACT_AXE_ANSWERS[0]);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
  await expect(
    page.getByRole("heading", { name: "这个问题对谁造成了什么具体损失？" })
  ).toBeVisible({ timeout: 15_000 });
  await expectNoAxeViolations(page);
});

test("Axe: 问题种子态无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/start");
  await beginCoach(page);
  for (const [index, answer] of ACT_AXE_ANSWERS.entries()) {
    await expect(
      page.getByRole("heading", { name: ACT_AXE_QUESTIONS[index] })
    ).toBeVisible();
    await page.locator("#coach-answer").fill(answer);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
  /* J-5 揭示拍:种子卡槽位 0–280ms 错峰入场,等动画落定再扫描(§25 教训) */
  await expect
    .poll(() =>
      page
        .locator(".seed-card .motion-slot-in")
        .evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1"))
    )
    .toBe(true);
  await expectNoAxeViolations(page);
});

test("Axe: 问题种子态(移动端 390×844)无自动化可检测违规", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto("/start");
  await beginCoach(page);
  for (const [index, answer] of ACT_AXE_ANSWERS.entries()) {
    await expect(
      page.getByRole("heading", { name: ACT_AXE_QUESTIONS[index] })
    ).toBeVisible();
    await page.locator("#coach-answer").fill(answer);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
  /* J-5 揭示拍:种子卡槽位 0–280ms 错峰入场,等动画落定再扫描(§25 教训) */
  await expect
    .poll(() =>
      page
        .locator(".seed-card .motion-slot-in")
        .evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1"))
    )
    .toBe(true);
  await expectNoAxeViolations(page);
});

/* 打磨轮③ C1/C2(§25):交互态 Axe 零豁免扩展(空答错误/附件选中/附件错误/
   等待取消/抽屉开态),关键键盘激活路径并入同批用例 */

test("Axe+键盘: 空答案行内错误态(390×844)无违规", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto("/start");
  await beginCoach(page);
  await expect(
    page.getByRole("heading", { name: ACT_AXE_QUESTIONS[0] })
  ).toBeVisible();

  /* 键盘路径:聚焦提交按钮后 Enter 提交空答案 */
  const submit = page.getByRole("button", { name: "提交这一问的回答" });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#coach-answer-error")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Axe: 附件选中态(1024×768)无违规", async ({ page }) => {
  await page.setViewportSize(tablet);
  await page.goto("/start");
  await beginCoach(page);
  await expect(
    page.getByRole("heading", { name: ACT_AXE_QUESTIONS[0] })
  ).toBeVisible();

  await chooseAttachmentFile(page, {
    name: "pilot-notes.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# 对账记录\n- 异常记录分散在三处\n", "utf8"),
  });
  await expect(page.locator(".coach-attachment-chip")).toBeVisible();
  await expect(page.locator("#coach-attachment-note")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("Axe: 附件非法类型错误态(1024×768)无违规", async ({ page }) => {
  await page.setViewportSize(tablet);
  await page.goto("/start");
  await beginCoach(page);
  await expect(
    page.getByRole("heading", { name: ACT_AXE_QUESTIONS[0] })
  ).toBeVisible();

  await chooseAttachmentFile(page, {
    name: "floor-plan.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-not-allowed", "utf8"),
  });
  await expect(page.locator("#coach-attachment-error")).toBeVisible();
  await expect(page.locator(".coach-attachment-chip")).toHaveCount(0);
  await expectNoAxeViolations(page);
});

test("Axe+键盘: 等待/取消态(1440×900)无违规,Enter 可改用确定性追问", async ({ page }) => {
  await page.setViewportSize(desktop);
  /* 与韧性 spec 同法:故意迟到 20s,让 collect 拍的取消入口稳定在场 */
  await page.route("**/api/hub/coach", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20_000));
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "live",
          act: { judgment: "迟到", risk: "迟到", question: "迟到？", placeholder: "迟", emptyHint: "迟" },
        }),
      })
      .catch(() => undefined);
  });

  await page.goto("/start");
  await beginCoach(page);
  await page.locator("#coach-answer").fill("试验异常记录分散在三处,对账来回翻找。");
  await page.getByRole("button", { name: "提交这一问的回答" }).click();

  const cancel = page.getByRole("button", { name: "不再等待，改用确定性追问" });
  await expect(cancel).toBeVisible();
  /* 唯一窄域豁免(§25 记录):幕间过渡期问题 h1 短暂离场,page-has-heading-one
     为 best-practice 级规则而非 WCAG A/AA;过渡期朗读由聚焦的步骤文本承担(§20 M 系)。
     是否为过渡期引入常驻 h1 属产品决策,另行授权后收回本豁免。 */
  const results = await new AxeBuilder({ page })
    .disableRules(["page-has-heading-one"])
    .analyze();
  expect(results.violations).toEqual([]);

  /* 键盘路径:聚焦取消按钮后 Enter,本地 fixture 接管并推进到第二幕 */
  await cancel.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: ACT_AXE_QUESTIONS[1] })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".coach-provider-status")).toContainText("确定性追问");
});

test("Axe: 移动抽屉打开态(390×844)无违规", async ({ page }) => {
  await page.setViewportSize(mobile);
  await page.goto("/guide");

  await page.getByRole("button", { name: "打开导航菜单" }).click();
  await expect(page.locator("#hub-drawer")).toHaveAttribute("aria-hidden", "false");
  /* 抽屉开态有 opacity 过渡(var(--dur-rise)=300ms):半透明中途会让 Axe 的
     color-contrast 误报,等落定为 1 再扫描 */
  await expect
    .poll(() => page.locator("#hub-drawer").evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  await expectNoAxeViolations(page);

  await page.keyboard.press("Escape");
  await expect(page.locator("#hub-drawer")).toHaveAttribute("aria-hidden", "true");
});

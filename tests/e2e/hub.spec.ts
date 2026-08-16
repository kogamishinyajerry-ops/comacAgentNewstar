import { test, expect, type Page } from "@playwright/test";

/**
 * 阶段一公共 Hub 验收(开工提示词 §14 的十条流程 + 五张关键视口截图)。
 * 运行:npx playwright tests tests/e2e/hub.spec.ts
 */

const SHOTS = "docs/screenshots/phase1";

const ACT_QUESTIONS = {
  problem: [
    "你最想改变的具体工作瞬间是什么?",
    "这个问题对谁造成了什么具体损失?",
    "为什么普通大模型聊天不足以解决它?",
  ],
  idea: [
    "先不要描述功能。你观察到的真实问题是什么?",
    "这个问题影响谁，又如何证明它已经被改善?",
    "你的方案里,哪一步是普通大模型聊天做不到、必须靠 Agent 的?",
  ],
} as const;

async function answerActs(page: Page, questions: readonly string[], label: string) {
  for (let i = 0; i < questions.length; i++) {
    await expect(page.getByRole("heading", { name: questions[i] })).toBeVisible();
    await page.locator("#coach-answer").fill(`${label}回答 ${i + 1}`);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 8000 });
}

test.describe("桌面 1440×900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("1. 首屏:活动定位、主 CTA、次 CTA 与低强调链接", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("COMAC 青年 AI Agent 创新实践月").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "把一个真实问题,变成可验证的 AI Agent 作品" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "从一个真实问题开始" })).toBeVisible();
    await expect(page.getByRole("link", { name: "我已经有一个想法" })).toBeVisible();
    await expect(page.getByRole("link", { name: "先了解活动如何进行" })).toBeVisible();
    // 首屏不是项目列表或后台:无密集统计卡/排行榜/健康分
    const body = await page.textContent("body");
    for (const banned of ["排行榜", "健康分", "完成率"]) {
      expect(body).not.toContain(banned);
    }
    await page.screenshot({ path: `${SHOTS}/home-first-1440.png` });
  });

  test("2. 主 CTA 进入真实问题 Coach 预览,三幕后生成问题种子", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "从一个真实问题开始" }).click();
    await expect(page).toHaveURL(/\/start/);
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS.problem[0] })).toBeVisible();
    // 第一问交互中:截取 Coach 互动预览(第二幕已端上来)
    await page.locator("#coach-answer").fill("试验异常记录、依据和处理结果分散在三处,对账要来回翻找");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS.problem[1] })).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: `${SHOTS}/coach-preview-1440.png` });
    await page.locator("#coach-answer").fill("影响试验工程师与复核人,每次对账约多花两小时");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS.problem[2] })).toBeVisible({ timeout: 8000 });
    await page.locator("#coach-answer").fill("需要记住项目口径,按固定流程调用检索工具逐步核对并留痕");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 8000 });
    // 种子包含三幕摘录与缺口
    await expect(page.getByText("仍待深挖(诚实标注)")).toBeVisible();
    await expect(page.getByRole("link", { name: "进入完整实践流程" })).toBeVisible();
    await expect(
      page
        .getByText("回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。")
        .first()
    ).toBeVisible();
  });

  test("3. 次 CTA 进入已有想法预览:第一问挑战方案先行,不直接认可", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "我已经有一个想法" }).click();
    await expect(page).toHaveURL(/\/start\?entry=idea/);
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS.idea[0] })).toBeVisible();
    await answerActs(page, ACT_QUESTIONS.idea, "已有想法");
  });

  test("4. Coach 同屏只有一个主要问题和一个回答器", async ({ page }) => {
    for (const url of ["/", "/start"]) {
      await page.goto(url);
      if (url === "/") {
        await page.locator("#coach-preview").scrollIntoViewIfNeeded();
      }
      await expect(page.locator("#coach-answer")).toHaveCount(1);
      await expect(page.locator("#coach-question")).toHaveCount(1);
    }
  });

  test("5. 三类角色入口均能进入相应说明页", async ({ page }) => {
    await page.goto("/");
    await page.locator("#roles").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/home-roles-1440.png` });
    for (const [href, heading] of [
      ["/role/participant", "我是参赛者"],
      ["/role/reviewer", "我是评委"],
      ["/role/organizer", "我是组织者"],
    ] as const) {
      await page.locator(`#roles a[href="${href}"]`).click();
      await expect(page).toHaveURL(new RegExp(href.replace("/", "\\/")));
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByRole("heading", { name: "系统不会替你做什么" })).toBeVisible();
      await page.goBack();
      await page.locator("#roles").scrollIntoViewIfNeeded();
    }
  });

  test("6. 导航锚点与站内链接无死链", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? "")
    );
    // 锚点:页内目标存在
    for (const href of hrefs.filter((h) => h.startsWith("/#"))) {
      const id = href.slice(2);
      expect(
        await page.evaluate((sel) => document.getElementById(sel) !== null, id),
        `锚点 ${href} 应有对应元素`
      ).toBe(true);
    }
    // 站内路由全部可达
    const routes = new Set(
      hrefs
        .filter((h) => h.startsWith("/") && !h.startsWith("/#") && !h.includes("://"))
        .map((h) => h.split("#")[0])
    );
    expect(routes.size).toBeGreaterThanOrEqual(5);
    for (const route of routes) {
      const res = await request.get(route);
      expect(res.status(), `GET ${route}`).toBeLessThan(400);
    }
  });

  test("7. prefers-reduced-motion 下信息顺序不变,三幕流程完整", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "把一个真实问题,变成可验证的 AI Agent 作品" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "从一个真实问题开始" })).toBeVisible();
    await page.goto("/start");
    await answerActs(page, ACT_QUESTIONS.problem, "减弱动态");
    await expect(page.getByText("仍待深挖(诚实标注)")).toBeVisible();
  });

  test("8. 键盘完成 Coach 三幕输入与提交", async ({ page }) => {
    await page.goto("/start");
    // 仅用键盘 Tab 到回答器
    for (let i = 0; i < 60; i++) {
      if (await page.evaluate(() => document.activeElement?.id === "coach-answer")) break;
      await page.keyboard.press("Tab");
    }
    expect(await page.evaluate(() => document.activeElement?.id)).toBe("coach-answer");
    for (let i = 0; i < 3; i++) {
      // 等当前幕问题端上来,且焦点已接续到新一幕的回答器
      await expect(page.getByRole("heading", { name: ACT_QUESTIONS.problem[i] })).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 8000 })
        .toBe("coach-answer");
      await page.keyboard.type(`键盘回答 第${i + 1}幕`);
      await page.keyboard.press("Control+Enter");
    }
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 8000 });
  });

  test("9. 键盘完成角色选择与移动端抽屉(键盘 Esc 复位)", async ({ page }) => {
    await page.goto("/");
    // Tab 到参赛者入口并回车
    for (let i = 0; i < 80; i++) {
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("href"));
      if (focused === "/role/participant") break;
      await page.keyboard.press("Tab");
    }
    expect(await page.evaluate(() => document.activeElement?.getAttribute("href"))).toBe(
      "/role/participant"
    );
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "我是参赛者" })).toBeVisible();
  });
});

test.describe("移动端 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("10. 无横向滚动,CTA 可见可点", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const cta = page.getByRole("link", { name: "从一个真实问题开始" });
    await cta.scrollIntoViewIfNeeded();
    await expect(cta).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/home-first-390.png` });
    await cta.tap();
    await expect(page).toHaveURL(/\/start/);
  });

  test("11. 移动端 Coach 单焦点场景与抽屉导航", async ({ page }) => {
    await page.goto("/start");
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS.problem[0] })).toBeVisible();
    await expect(page.locator("#coach-answer")).toHaveCount(1);
    await page.locator("#coach-answer").fill("移动端第一幕回答");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(
      page.getByRole("heading", { name: ACT_QUESTIONS.problem[1] })
    ).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: `${SHOTS}/coach-390.png` });

    // 抽屉:打开 → 链接可达 → Esc 关闭并归还焦点
    const burger = page.getByRole("button", { name: "打开导航菜单" });
    await burger.click();
    await expect(page.locator("#hub-drawer")).toHaveAttribute("data-open", "true");
    await expect(page.locator("#hub-drawer").getByRole("link", { name: "活动介绍" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#hub-drawer")).toHaveAttribute("data-open", "false");
    await expect(burger).toBeFocused();
  });
});

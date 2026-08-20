import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  artifactCopy,
  coachDemoActs,
  coachDemoArtifactActs,
  coachIntroCopy,
  handoffCopy,
} from "../../fixtures/coach-demo";
import {
  ACT_ANSWERS,
  ACT_QUESTIONS,
  beginCoach,
  completeArtifact,
  completeThreeActs,
  submitCoachAnswer,
} from "./helpers";

/**
 * 旅程叙事轮(§31)验收:
 * - J-1 建立拍全路径(内容 → 开始第一问 → 第一幕焦点接续)与键盘全路径;
 * - J-2 N1 终章交棒(复制状态真实、后续节点 pending 诚实标注);
 * - J-3/J-4 指南页四节点操作层与 G0 三件套;
 * - P0-1 导出可追述(生成时间/卡号/格式版本/问答映射);
 * - J-5 揭示拍溯源编排(槽位错峰落位,reduce-motion 全降级)。
 */

const FIRST_QUESTION = "你最想改变的具体工作瞬间是什么?";
const SECOND_QUESTION = "这个问题对谁造成了什么具体损失?";
const PRIVACY_NOTICE =
  "回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

/** 卡内 J-5 错峰动画落定(§25 教训:半透明中途会误报对比度) */
async function waitRevealSettled(page: Page, cardSelector: string) {
  await expect
    .poll(() =>
      page
        .locator(`${cardSelector} .motion-slot-in`)
        .evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1"))
    )
    .toBe(true);
}

test.describe("J-1 建立拍", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("建立拍全路径:内容齐备 → 开始第一问 → 第一幕与焦点接续", async ({ page }) => {
    await page.goto("/start");

    /* 我在哪:到场三件套,第三步标注当前位置,未确认链接 pending 如实标注 */
    const intro = page.locator("[data-coach-intro]");
    await expect(intro).toBeVisible();
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(coachIntroCopy.title);
    /* §33:站点导航栏不在场;品牌眉行补活动身份,顶栏给流程位置 */
    await expect(page.locator(".hub-header")).toHaveCount(0);
    await expect(page.locator("[data-coach-intro-brand]")).toHaveText(
      "COMAC 青年 AI Agent 创新实践月",
    );
    await expect(page.locator(".coach-workspace-count")).toHaveText("开始之前 · 到场与流程");
    for (const key of ["workbuddy", "group", "site"] as const) {
      await expect(page.locator(`[data-intro-step="${key}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-intro-step="site"]')).toHaveAttribute(
      "data-intro-current",
      "true",
    );
    await expect(page.locator('[data-intro-step="workbuddy"]')).toContainText(
      "〔待活动配置确认〕",
    );
    await expect(page.locator('[data-intro-step="group"]')).toContainText("〔待活动配置确认〕");

    /* 要投入什么 / 会得到什么:6 问、10–15 分钟、可带走的卡 */
    for (const item of coachIntroCopy.flowItems) {
      await expect(intro).toContainText(item);
    }

    /* 隐私披露前置:告知先于输入;此拍不渲染小卡与回答器 */
    await expect(page.locator("[data-coach-privacy-note]")).toHaveText(PRIVACY_NOTICE);
    await expect(page.locator("[data-coach-progress]")).toHaveCount(0);
    await expect(page.locator("#coach-answer")).toHaveCount(0);

    /* 顶栏出口保留;唯一 CTA 是「开始第一问」 */
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toBeVisible();
    const begin = page.locator("[data-coach-begin]");
    await expect(begin).toHaveText(coachIntroCopy.beginLabel);

    await begin.click();
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
    /* §33 K2:顶栏流程位置文字化 */
    await expect(page.locator(".coach-workspace-count")).toHaveText("第 1 幕 · 问题(共 3 幕)");
    await expect(page.locator("#coach-answer")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 15_000 })
      .toBe("coach-answer");
  });

  test("键盘全路径:Tab 到「开始第一问」Enter 触发,焦点进回答器并可键盘提交", async ({
    page,
  }) => {
    await page.goto("/start");

    let reached = false;
    for (let i = 0; i < 40; i++) {
      const onBegin = await page.evaluate(
        () => document.activeElement?.hasAttribute("data-coach-begin") ?? false,
      );
      if (onBegin) {
        reached = true;
        break;
      }
      await page.keyboard.press("Tab");
    }
    expect(reached).toBe(true);

    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id), { timeout: 15_000 })
      .toBe("coach-answer");

    await page.keyboard.type("试验异常记录、依据和处理结果分散在三处,对账要来回翻找");
    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("heading", { name: SECOND_QUESTION })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("reduce-motion:建立拍入场无动画,内容与顺序不变", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/start");

    const intro = page.locator("[data-coach-intro]");
    await expect(intro).toBeVisible();
    const animationName = await intro.evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe("none");

    /* 三件套顺序不变,隐私披露与 CTA 仍在 */
    const stepOrder = await page.locator("[data-intro-step]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-intro-step")),
    );
    expect(stepOrder).toEqual(["workbuddy", "group", "site"]);
    await expect(page.locator("[data-coach-privacy-note]")).toHaveText(PRIVACY_NOTICE);
    await expect(page.locator("[data-coach-begin]")).toBeVisible();

    /* 流程不变:begin 后照常进入第一幕 */
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
  });

  test("建立拍 Axe 零违规", async ({ page }) => {
    await page.goto("/start");
    await expect(page.locator("[data-coach-intro]")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("375×812:建立拍零溢出,begin 后第一幕同样零溢出", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/start");
    await expect(page.locator("[data-coach-intro]")).toBeVisible();

    const introMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(introMetrics.overflow).toBeLessThanOrEqual(0);
    expect(introMetrics.documentHeight).toBeLessThanOrEqual(introMetrics.viewportHeight + 1);

    await beginCoach(page);
    await expect(page.getByRole("heading", { name: FIRST_QUESTION })).toBeVisible();
    const questionMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(questionMetrics.overflow).toBeLessThanOrEqual(0);
    expect(questionMetrics.documentHeight).toBeLessThanOrEqual(
      questionMetrics.viewportHeight + 1,
    );
  });
});

test.describe("J-2 N1 终章交棒", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("复制状态真实、paste/N2 pending 标注、指南链接可达,交棒区 Axe 零违规", async ({
    page,
  }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await completeArtifact(page);

    const handoff = page.locator("[data-coach-handoff]");
    await expect(handoff).toBeVisible();

    /* 复制前:第一步只反映真实状态——未复制,提示先点上方复制 */
    const copiedStep = page.locator('[data-handoff-step="copied"]');
    await expect(copiedStep).toHaveAttribute("data-handoff-done", "false");
    await expect(copiedStep).toContainText("先点上方「复制问题定义」");
    await expect(copiedStep).not.toContainText("已复制带走");

    /* 授权剪贴板点击复制后:第一步转为已复制带走 */
    await page.getByRole("button", { name: artifactCopy.copyLabel }).click();
    await expect(page.locator("[data-artifact-copy-status]")).toHaveText(/已复制/);
    await expect(copiedStep).toHaveAttribute("data-handoff-done", "true");
    await expect(copiedStep).toContainText("已复制带走");

    /* 后续节点一律 pending 诚实标注,不预支未开放能力 */
    await expect(page.locator('[data-handoff-step="paste"]')).toContainText(
      "群与文件夹链接待活动配置确认",
    );
    await expect(page.locator('[data-handoff-step="n2"]')).toContainText(
      "第 2 周 · 待活动配置确认",
    );
    await expect(page.locator("[data-handoff-guide]")).toHaveAttribute("href", "/guide");

    /* 交棒区 Axe:等卡内揭示拍动画落定再扫描 */
    await waitRevealSettled(page, "[data-artifact-card]");
    await expectNoAxeViolations(page);
  });
});

test.describe("J-3/J-4 指南页四节点操作层", () => {
  test("G0 三件套 pending 如实标注,N1 进行中链接 /start,N2–N4 待配置,五段方法论仍在", async ({
    page,
  }) => {
    await page.goto("/guide");

    const journey = page.locator("[data-guide-journey]");
    await expect(journey).toBeVisible();

    /* G0 到场三件套:链接未确认一律 pending;第三步是当前位置,可进入问题探索 */
    for (const key of ["workbuddy", "group", "site"] as const) {
      await expect(page.locator(`[data-guide-arrival="${key}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-guide-arrival="workbuddy"]')).toContainText(
      "待活动配置确认",
    );
    await expect(page.locator('[data-guide-arrival="group"]')).toContainText("待活动配置确认");
    await expect(
      page.locator('[data-guide-arrival="site"]').getByRole("link", { name: "进入问题探索" }),
    ).toHaveAttribute("href", "/start");

    /* 四节点:N1 进行中可进入;N2–N4 结构可见、开放待配置 */
    const n1 = page.locator('[data-guide-node="n1"]');
    await expect(n1).toHaveAttribute("data-guide-node-status", "in-progress");
    await expect(n1.getByRole("link")).toHaveAttribute("href", "/start");
    await expect(n1).toContainText("进行中");

    const pendingWeeks: ReadonlyArray<readonly [string, string]> = [
      ["n2", "第 2 周开放 · 待活动配置确认"],
      ["n3", "第 3 周开放 · 待活动配置确认"],
      ["n4", "第 4 周开放 · 待活动配置确认"],
    ];
    for (const [key, label] of pendingWeeks) {
      const node = page.locator(`[data-guide-node="${key}"]`);
      await expect(node).toHaveAttribute("data-guide-node-status", "pending");
      await expect(node).toContainText(label);
    }

    /* 方法论五段保留 */
    await expect(
      page.getByRole("heading", { name: "方法论:五段实践路径,不是十个步骤" }),
    ).toBeVisible();
  });
});

test.describe("P0-1 导出可追述", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const TRACE_PATTERNS = [
    /生成时间:\d{4}-\d{2}-\d{2} \d{2}:\d{2}\(本地时钟\)/,
    /卡号:QD-[A-Z0-9]{5}\(本会话生成,未落库\)/,
    /格式版本:v1/,
  ] as const;

  test("种子复制文本含生成时间/卡号/格式版本/问答映射", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await completeThreeActs(page);

    await page.getByRole("button", { name: "复制问题种子" }).click();
    await expect(page.locator("[data-seed-copy-status]")).toHaveText(/已复制/);

    const text = await page.evaluate(() => navigator.clipboard.readText());
    for (const pattern of TRACE_PATTERNS) {
      expect(text).toMatch(pattern);
    }
    expect(text).toContain("问答映射:主张←第1·3幕;影响←第2幕");
  });

  test("问题定义复制文本含同一头部,问答映射另含深化轮", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await completeArtifact(page);

    await page.getByRole("button", { name: artifactCopy.copyLabel }).click();
    await expect(page.locator("[data-artifact-copy-status]")).toHaveText(/已复制/);

    const text = await page.evaluate(() => navigator.clipboard.readText());
    for (const pattern of TRACE_PATTERNS) {
      expect(text).toMatch(pattern);
    }
    expect(text).toContain("问答映射:主张←第1·3幕;影响←第2幕;深化←第4–6轮");
  });
});

test.describe("J-5 揭示拍", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("六槽在场且 animationDelay 递增,reduce-motion 全降级,诚实注记在场", async ({
    page,
  }) => {
    await completeArtifact(page);

    /* 六槽在场,错峰延迟按会话时序递增 */
    const expectedDelays: ReadonlyArray<readonly [string, string]> = [
      ["moment", "0ms"],
      ["impact", "140ms"],
      ["necessity", "280ms"],
      ["deepening-0", "420ms"],
      ["deepening-1", "560ms"],
      ["deepening-2", "700ms"],
    ];
    const delays: number[] = [];
    for (const [key, delay] of expectedDelays) {
      const slot = page.locator(`[data-artifact-card] [data-reveal-slot="${key}"]`);
      await expect(slot).toHaveCount(1);
      /* 读内联样式原值(计算值会被归一化为秒) */
      const inlineDelay = await slot.evaluate(
        (el) => (el as HTMLElement).style.animationDelay,
      );
      expect(inlineDelay).toBe(delay);
      delays.push(Number.parseInt(delay, 10));
    }
    expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    expect(new Set(delays).size).toBe(delays.length);

    /* 诚实注记:摘录不等于已验证的证据 */
    await expect(page.locator("[data-artifact-card]")).toContainText(
      "来自本次会话回答的摘录,不构成已验证的证据",
    );

    /* reduce-motion:.motion-slot-in 关键帧只在 no-preference 定义,切换后计算样式无动画 */
    await page.emulateMedia({ reducedMotion: "reduce" });
    const animationName = await page
      .locator("[data-artifact-card] .motion-slot-in")
      .first()
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(animationName).toBe("none");
  });
});

test.describe("打磨轮⑦:可读性(判断入史/Artifact 栏/grown 主行动)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("回看抽屉留下每轮判断与风险:首轮无过渡拍不渲染,后续轮如实入史(§32 I1)", async ({
    page,
  }) => {
    await page.goto("/start");
    await beginCoach(page);
    /* 走完前两幕开抽屉:第一轮(无过渡拍)无判断/风险,第二轮有且为实际端上内容 */
    await submitCoachAnswer(page, ACT_ANSWERS[0]);
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await submitCoachAnswer(page, ACT_ANSWERS[1]);
    await expect(page.getByRole("heading", { name: ACT_QUESTIONS[2] })).toBeVisible({
      timeout: 15_000,
    });

    await page.locator("[data-coach-review-trigger]").click();
    await expect(page.locator("[data-coach-review]")).toBeVisible();
    await expect(page.locator("[data-coach-review-item]")).toHaveCount(2);
    await expect(page.locator("[data-coach-review-jr]")).toHaveCount(1);
    await expect(page.locator("[data-coach-review-jr]")).toContainText(
      `当时的判断:${coachDemoActs.problem[1].judgment}`,
    );
    await expect(page.locator("[data-coach-review-jr]")).toContainText(
      `当时的风险:${coachDemoActs.problem[1].risk}`,
    );
  });

  test("种子卡主行动唯一且说清代价:位置提示在场,CTA 直启深化(§32 I3)", async ({ page }) => {
    await completeThreeActs(page);
    await expect(page.locator("[data-seed-position]")).toContainText("再答 3 问");
    const cta = page.locator("[data-seed-deepen-cta]");
    await expect(cta).toBeVisible();
    /* 主 CTA 是按钮而非侧栏发现;了解路径降级为安静链接仍在场 */
    await expect(page.getByRole("link", { name: /了解完整实践路径/ })).toBeVisible();
    await cta.click();
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[0].question }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Artifact 栏可读:四槽名称/说明/状态徽标可见,grown 态 Axe 零违规(§32 I2)", async ({
    page,
  }) => {
    await completeThreeActs(page);
    const rail = page.locator(".coach-artifact-rail");
    await expect(rail).toBeVisible();

    const names = rail.locator(".coach-artifact-name");
    await expect(names).toHaveCount(4);
    await expect(names.nth(0)).toHaveText("深化问题定义");
    await expect(names.nth(1)).toHaveText("用户与场景");
    await expect(names.nth(2)).toHaveText("Agent 方案");
    await expect(names.nth(3)).toHaveText("验证计划");
    await expect(rail.locator(".coach-artifact-desc").nth(0)).toContainText("再答 3 问");
    await expect(rail.getByText("可深化", { exact: true })).toBeVisible();
    await expect(rail.getByText("未开放", { exact: true })).toHaveCount(3);
    await expect(rail.getByText("完整流程中逐份沉淀").first()).toBeVisible();

    await waitRevealSettled(page, ".seed-card");
    await expectNoAxeViolations(page);
  });
});

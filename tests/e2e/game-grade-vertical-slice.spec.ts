import { expect, test, type Page } from "@playwright/test";

const FIRST_ANSWER =
  "试验异常记录分散在三处，对账时需要反复翻找同一条依据。";
const SECOND_ANSWER =
  "值班工程师每次要多花二十分钟核对来源，还容易漏掉人工改写。";
const THIRD_ANSWER =
  "它需要持续读取多份记录、调用检索工具并保留每次判断依据，单轮聊天不足。";

async function enterExperience(page: Page) {
  await page.goto("/experience");
  const intro = page.locator("[data-game-grade-intro]");
  await expect(intro).toBeVisible();
  await page.getByRole("button", { name: "唤醒问题" }).click();
  await expect(intro).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator("#coach-answer")).toBeFocused();
}

test.describe("Game-grade Vertical Slice", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("序章只交出一个主要动作，结束后把焦点交给真实 Coach", async ({
    page,
  }: { page: Page }) => {
    await page.goto("/experience");

    const slice = page.locator("[data-game-grade-slice]");
    const intro = page.locator("[data-game-grade-intro]");
    const stage = page.locator("[data-game-grade-stage]");

    await expect(slice).toBeVisible();
    await expect(intro).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /让一个真实问题，\s*自己长出结构/,
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "唤醒问题" })).toBeFocused();
    await expect(
      intro.getByRole("link", { name: "直接进入简洁模式" }),
    ).toHaveAttribute("href", "/start");
    await expect(stage).toHaveAttribute("inert", "");
    await expect(intro).toContainText("无积分 · 无排行 · 不替你做判断");

    await page.getByRole("button", { name: "唤醒问题" }).click();

    await expect(intro).toHaveCount(0, { timeout: 3_000 });
    await expect(stage).not.toHaveAttribute("inert", "");
    await expect(page.locator("#coach-answer")).toBeFocused();
    await expect(page.locator("[data-game-grade-journey]")).toHaveAccessibleName(
      /等待第一条真实线索/,
    );
    await expect(page.locator("[data-game-grade-step]")).toHaveCount(3);
    await expect(
      page.locator('[data-game-grade-step="moment"]'),
    ).toHaveAttribute("data-state", "current");
  });

  test("Escape 可跳过序章，仍进入同一条真实工作流", async ({ page }: { page: Page }) => {
    await page.goto("/experience?entry=idea");
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-game-grade-intro]")).toHaveCount(0, {
      timeout: 3_000,
    });
    await expect(page.locator("#coach-answer")).toBeFocused();
    await expect(page.getByRole("heading", { name: /先不要描述功能/ })).toBeVisible();
  });

  test("每次回答都改变同一条问题种子轨迹，第三问后完成凝结", async ({
    page,
  }: { page: Page }) => {
    await enterExperience(page);

    await page.locator("#coach-answer").fill(FIRST_ANSWER);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(
      page.getByRole("heading", {
        name: /这个问题对谁造成了什么具体损失/,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-game-grade-slice]")).toHaveAttribute(
      "data-journey-completed",
      "1",
    );
    await expect(
      page.locator('[data-game-grade-step="moment"]'),
    ).toHaveAttribute("data-state", "complete");
    await expect(
      page.locator('[data-game-grade-step="impact"]'),
    ).toHaveAttribute("data-state", "current");

    await page.locator("#coach-answer").fill(SECOND_ANSWER);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(
      page.getByRole("heading", {
        name: /为什么普通大模型聊天不足以解决它/,
      }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-game-grade-slice]")).toHaveAttribute(
      "data-journey-completed",
      "2",
    );
    await expect(
      page.locator('[data-game-grade-step="necessity"]'),
    ).toHaveAttribute("data-state", "current");

    await page.locator("#coach-answer").fill(THIRD_ANSWER);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();

    await expect(page.locator(".coach-workspace-grid--grown")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-game-grade-slice]")).toHaveAttribute(
      "data-journey-completed",
      "3",
    );
    await expect(page.locator("[data-game-grade-journey]")).toHaveAccessibleName(
      /问题种子已凝结/,
    );
    await expect(
      page.locator('[data-game-grade-step][data-state="complete"]'),
    ).toHaveCount(3);
  });

  test("活动页主 CTA 进入沉浸切片，简洁模式仍保留", async ({ page }: { page: Page }) => {
    await page.goto("/guide");
    await expect(
      page.getByRole("link", { name: "开始探索", exact: true }),
    ).toHaveAttribute("href", "/experience");
    await expect(
      page.getByRole("link", { name: "开始一次问题探索" }),
    ).toHaveAttribute("href", "/start");
  });
});

test("390×844 + Reduced Motion：序章即时退出且无页面溢出", async ({
  page,
}: { page: Page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/experience?entry=idea");

  const seedStage = page.locator("[data-game-grade-seed]");
  await expect(seedStage).toBeVisible();
  expect(
    await seedStage.evaluate(
      (element: HTMLElement) => getComputedStyle(element).animationName,
    ),
  ).toBe("none");

  await page.getByRole("button", { name: "唤醒问题" }).press("Enter");
  await expect(page.locator("[data-game-grade-intro]")).toHaveCount(0);
  await expect(page.locator("#coach-answer")).toBeFocused();
  await expect(page.locator("[data-game-grade-step]")).toHaveCount(3);

  const geometry = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
  }));
  expect(geometry.horizontal).toBeLessThanOrEqual(0);
  expect(geometry.documentHeight).toBeLessThanOrEqual(
    geometry.viewportHeight + 1,
  );
});

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
    const skipLink = page.locator(".hub-skip-link");
    await expect(skipLink).toHaveAttribute("href", "#game-grade-intro-title");
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#game-grade-intro-title")).toBeFocused();
    await expect(
      intro.getByRole("link", { name: "直接进入简洁模式" }),
    ).toHaveAttribute("href", "/start");
    await expect(stage).toHaveAttribute("inert", "");
    // 序章拥有唯一场景:journey 轨迹在序章关闭前必须一并隔离。
    // 轨迹条只读,不含任何跳页链接(流程中切换入口会丢失全部回答)。
    const journey = page.locator("[data-game-grade-journey]");
    await expect(journey).toHaveAttribute("inert", "");
    await expect(journey).toHaveAttribute("aria-hidden", "true");
    await expect(journey.getByRole("link")).toHaveCount(0);
    await page.keyboard.press("Shift+Tab");
    expect(
      await page.evaluate(
        () =>
          document.activeElement?.closest("[data-game-grade-journey]") !==
          null,
      ),
    ).toBe(false);
    await expect(intro).toContainText("无积分 · 无排行 · 不替你做判断");

    await page.getByRole("button", { name: "唤醒问题" }).click();

    await expect(intro).toHaveCount(0, { timeout: 3_000 });
    await expect(stage).not.toHaveAttribute("inert", "");
    await expect(journey).not.toHaveAttribute("inert", "");
    await expect(journey).toHaveAttribute("aria-hidden", "false");
    await expect(skipLink).toHaveAttribute("href", "#hub-main");
    await expect(page.locator("#coach-answer")).toBeFocused();
    await expect(page.locator("[data-game-grade-journey]")).toHaveAccessibleName(
      /等待第一条真实线索/,
    );
    await expect(page.locator("[data-game-grade-step]")).toHaveCount(3);
    await expect(
      page.locator('[data-game-grade-step="moment"]'),
    ).toHaveAttribute("data-state", "current");
    await expect(page.locator("[data-game-grade-outcome]")).toHaveAttribute(
      "data-state",
      "forming",
    );
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

    const journey = page.locator("[data-game-grade-journey]");
    await expect(journey).toHaveAttribute("data-busy", "true");
    await expect(page.locator("[data-game-grade-outcome]")).toContainText(
      "正在重排线索",
    );
    await expect(page.locator("[data-game-grade-outcome]")).toHaveAttribute(
      "data-state",
      "forming",
    );

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
    await expect(page.locator("[data-game-grade-outcome]")).toHaveAttribute(
      "data-state",
      "condensed",
    );
  });

  test("种子凝结后进入深化轮,世界状态不回退到旧一幕", async ({
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

    await page.locator("#coach-answer").fill(SECOND_ANSWER);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(
      page.getByRole("heading", {
        name: /为什么普通大模型聊天不足以解决它/,
      }),
    ).toBeVisible({ timeout: 15_000 });

    await page.locator("#coach-answer").fill(THIRD_ANSWER);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(page.locator(".coach-workspace-grid--grown")).toBeVisible({
      timeout: 15_000,
    });

    const slice = page.locator("[data-game-grade-slice]");
    await expect(slice).toHaveAttribute("data-journey-phase", "seed");

    await page.locator("[data-artifact-entry]").click();
    await expect(
      page.getByRole("heading", { name: /受影响的人大约有多少/ }),
    ).toBeVisible({ timeout: 15_000 });

    // 深化轮期间没有 --grown 也没有 data-artifact-lit,
    // 但世界状态必须停在 Artifact 阶段,不得回退到第二幕的旧文案。
    await expect(slice).toHaveAttribute("data-journey-phase", "artifact");
    await expect(slice).toHaveAttribute("data-journey-completed", "3");
    await expect(
      page.locator("[data-game-grade-journey]"),
    ).toHaveAccessibleName(/已进入第一份 Artifact/);

    await page
      .locator("#coach-answer")
      .fill("大约六名值班工程师,每个班次都会遇到一次。");
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
    await expect(
      page.getByRole("heading", { name: /改善之后/ }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(slice).toHaveAttribute("data-journey-phase", "artifact");
    await expect(slice).toHaveAttribute("data-journey-completed", "3");
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

test("390×844：抽屉与序章的 Escape 归属唯一", async ({
  page,
}: { page: Page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/experience");

  const intro = page.locator("[data-game-grade-intro]");
  const burger = page.getByRole("button", { name: "打开导航菜单" });
  await burger.click();
  await expect(page.locator("#hub-drawer")).toHaveAttribute("aria-hidden", "false");

  await page.keyboard.press("Escape");
  await expect(page.locator("#hub-drawer")).toHaveAttribute("aria-hidden", "true");
  await expect(burger).toBeFocused();
  await expect(intro).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(intro).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator("#coach-answer")).toBeFocused();
});

test("1024×768 + 200% 文本：序章可读、可操作且无水平溢出", async ({
  page,
}: { page: Page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/experience");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });

  const title = page.locator("#game-grade-intro-title");
  const lead = page.locator("#game-grade-intro-description");
  const start = page.getByRole("button", { name: "唤醒问题" });
  await expect(title).toBeVisible();
  await expect(lead).toBeVisible();
  await start.scrollIntoViewIfNeeded();
  await expect(start).toBeVisible();

  const metrics = await page.evaluate(() => ({
    horizontal: document.documentElement.scrollWidth - window.innerWidth,
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    titleSize: Number.parseFloat(
      getComputedStyle(document.querySelector("#game-grade-intro-title")!).fontSize,
    ),
    leadSize: Number.parseFloat(
      getComputedStyle(document.querySelector("#game-grade-intro-description")!).fontSize,
    ),
  }));
  expect(metrics.horizontal).toBeLessThanOrEqual(0);
  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.titleSize).toBeGreaterThanOrEqual(70);
  expect(metrics.leadSize).toBeGreaterThanOrEqual(28);
});

test("Forced Colors：journey 当前、完成与未来状态不只依赖颜色", async ({
  page,
}: { page: Page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ forcedColors: "active" });
  await enterExperience(page);

  const styles = await page.evaluate(() => {
    const current = document.querySelector<HTMLElement>(
      '[data-game-grade-step][data-state="current"] > span[aria-hidden="true"]',
    );
    const future = document.querySelector<HTMLElement>(
      '[data-game-grade-step][data-state="future"] > span[aria-hidden="true"]',
    );
    if (!current || !future) throw new Error("journey markers missing");
    return {
      currentBorderStyle: getComputedStyle(current).borderStyle,
      futureBorderStyle: getComputedStyle(future).borderStyle,
    };
  });
  expect(styles.currentBorderStyle).toBe("double");
  expect(styles.futureBorderStyle).toBe("dashed");

  await page.locator("#coach-answer").fill(FIRST_ANSWER);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
  await expect(
    page.getByRole("heading", { name: /这个问题对谁造成了什么具体损失/ }),
  ).toBeVisible({ timeout: 15_000 });
  const completed = page.locator(
    '[data-game-grade-step][data-state="complete"] > span[aria-hidden="true"]',
  );
  await expect(completed).toHaveText("✓");
  expect(await completed.evaluate((node) => getComputedStyle(node).borderStyle)).toBe(
    "solid",
  );
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
  // overflow:clip 根容器不允许任何程序化滚动,
  // journey 轨迹不得被焦点时序竞争推出视口。
  expect(
    await page
      .locator("[data-game-grade-slice]")
      .evaluate((element: HTMLElement) => element.scrollTop),
  ).toBe(0);

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

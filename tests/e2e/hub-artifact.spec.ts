import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { artifactCopy, coachDemoArtifactActs } from "../../fixtures/coach-demo";
import {
  DEEPENING_ANSWERS,
  completeArtifact,
  completeThreeActs,
  submitCoachAnswer,
} from "./helpers";

/**
 * 第四幕:问题定义 Artifact(§22 阶段1 / §28)。
 * 三幕后第一格点亮 → 三轮一问一答深化 → 确定性凝结问题定义卡 →
 * 纯文本导出;全程无持久化,降级路径回退确定性 fixture。
 * 旅程叙事轮(§31):三幕/深化流程收敛到 ./helpers(内含建立拍 click-through)。
 */

async function answerArtifactRound(page: Page, round: number) {
  await expect(
    page.getByRole("heading", { name: coachDemoArtifactActs[round].question })
  ).toBeVisible({ timeout: 15_000 });
  await submitCoachAnswer(page, DEEPENING_ANSWERS[round]);
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("第四幕:问题定义 Artifact", () => {
  test("种子后第一格点亮,三轮深化凝结问题定义卡并可复制导出", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await completeThreeActs(page);

    /* 种子态:第一格是真实入口,其余三格仍是图标预告 */
    const entry = page.locator("[data-artifact-entry]");
    await expect(entry).toBeVisible();
    await expect(page.locator("[data-coach-artifact]")).toHaveCount(4);
    await entry.click();

    /* 三轮深化:每轮一问,顶栏计数带"深化"前缀 */
    for (let round = 0; round < 3; round += 1) {
      await answerArtifactRound(page, round);
    }

    /* 问题定义卡:深化记录三轮齐全,缺口原样保留(深化不等于解决) */
    const card = page.locator("[data-artifact-card]");
    await expect(card).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: artifactCopy.doneSubtitle })
    ).toBeVisible();
    await expect(page.locator("[data-artifact-deepening-item]")).toHaveCount(3);
    for (const label of artifactCopy.dimensionLabels) {
      await expect(page.locator("[data-artifact-deepening]", { hasText: label })).toBeVisible();
    }
    await expect(page.locator("[data-seed-gaps] .seed-gap")).toHaveCount(3);
    await expect(page.getByText(artifactCopy.deepeningNote)).toBeVisible();

    /* 第一格常亮为"问题定义·已深化" */
    await expect(page.locator("[data-artifact-lit]")).toBeVisible();

    /* 复制导出:纯文本含深化记录三段、缺口与诚实尾注 */
    await page.getByRole("button", { name: artifactCopy.copyLabel }).click();
    await expect(page.locator("[data-artifact-copy-status]")).toHaveText(/已复制/);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("【深化记录】");
    for (const label of artifactCopy.dimensionLabels) {
      expect(text).toContain(`·${label}`);
    }
    expect(text).toContain("四十名试验工程师");
    expect(text).toContain("【缺口】");
    expect(text).toContain(artifactCopy.deepeningNote);
  });

  test("深化中可安静返回种子,进度保留后从首个未完成轮继续", async ({ page }) => {
    await completeThreeActs(page);
    await page.locator("[data-artifact-entry]").click();
    await answerArtifactRound(page, 0);

    /* 第二轮问题端上后再返回(过渡期返回入口禁用);种子卡可见,再入从第二轮继续 */
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[1].question })
    ).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: `← ${artifactCopy.backToSeedLabel}` }).click();
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible();
    await page.locator("[data-artifact-entry]").click();
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[1].question })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("接口失败时深化轮回退确定性 fixture,仍可走到问题定义", async ({ page }) => {
    await page.route("**/api/hub/coach", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "provider-down" }),
      })
    );

    await completeThreeActs(page);
    await page.locator("[data-artifact-entry]").click();

    /* 全程回退 fixture:三轮问题仍是确定性文案;断网告警在中间轮的问题态在场 */
    for (let round = 0; round < 3; round += 1) {
      await expect(
        page.getByRole("heading", { name: coachDemoArtifactActs[round].question })
      ).toBeVisible({ timeout: 15_000 });
      await submitCoachAnswer(page, DEEPENING_ANSWERS[round]);
      if (round === 0) {
        await expect(
          page.locator('[role="alert"]', { hasText: "AI 服务暂不可用" })
        ).toBeVisible({ timeout: 15_000 });
      }
    }
    /* 终态凝结问题定义卡(告警随表单区折叠退出,不在卡上断言) */
    await expect(page.locator("[data-artifact-card]")).toBeVisible({ timeout: 15_000 });
  });

  test("第一格入口可仅用键盘触发(Enter),深化问题态零 Axe 违规", async ({ page }) => {
    await completeThreeActs(page);

    const entry = page.locator("[data-artifact-entry]");
    await entry.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[0].question })
    ).toBeVisible({ timeout: 15_000 });

    await expectNoAxeViolations(page);
  });

  test("问题定义卡态零 Axe 违规", async ({ page }) => {
    await page.route("**/api/hub/coach", (route) => {
      if (route.request().method() !== "POST") {
        void route.continue();
        return;
      }
      void route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mode: "fixture" }),
      });
    });

    await completeArtifact(page);

    /* 卡片有入场凝结动效,等透明度落定再扫描(§25 教训);
       J-5 揭示拍内层槽位还有 0–700ms 错峰动画,一并等齐 */
    await expect
      .poll(() =>
        page.locator("[data-artifact-card]").evaluate((el) => getComputedStyle(el).opacity)
      )
      .toBe("1");
    await expect
      .poll(() =>
        page
          .locator("[data-artifact-card] .motion-slot-in")
          .evaluateAll((els) => els.every((el) => getComputedStyle(el).opacity === "1"))
      )
      .toBe(true);
    await expectNoAxeViolations(page);
  });
});

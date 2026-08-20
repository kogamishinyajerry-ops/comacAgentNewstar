import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { coachDemoArtifactActs } from "../../fixtures/coach-demo";
import { beginCoach, completeThreeActs, submitCoachAnswer } from "./helpers";

/**
 * 打磨轮⑥(§29):进展可感知。
 * 常驻问题卡(幽灵→点亮→高亮)、等待计时、阶段性指南出口、回看抽屉、
 * 深化三槽模板、Axe 零违规与窄屏进度条零溢出。
 * 旅程叙事轮(§31):首屏幽灵槽断言改为建立拍 begin 后;
 * 指南出口保留在建立拍与第一幕问题态都要成立。
 */

const QUESTIONS = [
  "你最想改变的具体工作瞬间是什么？",
  "这个问题对谁造成了什么具体损失？",
  "为什么普通大模型聊天不足以解决它？",
] as const;

const ANSWERS = [
  "试验异常记录、依据和处理结果分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

const DEEPENING_ANSWERS = [
  "大约四十名试验工程师,每周对账三次,每次多花约两小时",
  "对账时长从两小时降到半小时,且不再出现漏找依据的返工",
  "必须按固定流程调用检索工具并逐步留痕,普通对话记不住口径也不留痕",
] as const;

test.describe("打磨轮⑥:常驻问题卡与阶段性指南出口", () => {
  test("首屏:三格幽灵槽与缺口摘要在场;指南出口保留、回看尚未接替", async ({ page }) => {
    await page.goto("/start");
    // 指南出口在建立拍成立(G1:还有退路价值的时刻,出口不回退)
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toBeVisible();
    await beginCoach(page);
    // 第一幕问题态:指南出口同样保留
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    await expect(page.locator("[data-coach-progress]")).toBeVisible();
    for (const key of ["moment", "impact", "necessity"]) {
      await expect(page.locator(`[data-coach-slot="${key}"]`)).toHaveAttribute(
        "data-coach-slot-filled",
        "false",
      );
    }
    await expect(page.locator('[data-coach-slot="moment"]')).toContainText("待打磨");
    await expect(page.getByText("缺口 3 条 · 诚实保留")).toBeVisible();
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toBeVisible();
    await expect(page.locator("[data-coach-review-trigger]")).toHaveCount(0);
  });

  test("提交瞬间第一格点亮并高亮;等待期计时不伪造阶段;完整回答不落屏", async ({ page }) => {
    /* mock 响应即时返回,用路由延迟保住等待窗口以断言等待态 */
    await page.route("**/api/hub/coach", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto("/start");
    await beginCoach(page);
    await submitCoachAnswer(page, ANSWERS[0]);

    /* 沉淀即时:不必等模型,回答的去向立刻可见 */
    await expect(page.locator('[data-coach-slot="moment"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
    await expect(page.locator('[data-coach-slot-just="true"]')).toBeVisible();

    /* 等待计时:只报已等待时长 */
    await expect(page.locator("[data-coach-waiting]")).toBeVisible();
    await expect(page.getByText(/AI Coach 正在思考 ·/)).toBeVisible();

    /* 压缩原则不破:完整回答不出现在页面上 */
    await expect(page.getByText(ANSWERS[0])).toHaveCount(0);

    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("作答后指南出口退位给回看;回看抽屉全文问答、当前行、Esc 关闭并归还焦点", async ({
    page,
  }) => {
    await page.goto("/start");
    await beginCoach(page);
    await submitCoachAnswer(page, ANSWERS[0]);
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByRole("link", { name: /返回活动指南/ })).toHaveCount(0);
    const trigger = page.locator("[data-coach-review-trigger]");
    await expect(trigger).toBeVisible();
    await trigger.click();

    await expect(page.locator("[data-coach-review]")).toBeVisible();
    await expect(page.locator("[data-coach-review-item]")).toHaveCount(1);
    /* 抽屉内完整回答可见——压缩原则由"默认关闭"承接 */
    await expect(page.getByText(ANSWERS[0])).toBeVisible();
    await expect(page.locator("[data-coach-review-current-label]")).toContainText(
      "当前:第 2 幕",
    );
    /* 指南链接在抽屉页脚常驻可达 */
    await expect(page.getByRole("link", { name: /回到活动指南/ })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-coach-review]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("过渡期打开回看抽屉:过渡拍不抢焦点,Esc 仍关闭并归还焦点(§31 修复)", async ({ page }) => {
    /* mock 响应加延迟撑开过渡窗口:抽屉开态下 judgment/risk 拍会正常更替 */
    await page.route("**/api/hub/coach", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto("/start");
    await beginCoach(page);
    await submitCoachAnswer(page, ANSWERS[0]);

    const trigger = page.locator("[data-coach-review-trigger]");
    await trigger.click();
    await expect(page.locator("[data-coach-review]")).toBeVisible();

    /* 过渡拍更替(judgment 端上)时,焦点仍在抽屉面板内——模态焦点陷阱不被抢走 */
    await expect(page.locator('[data-transition-step="judgment"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect
      .poll(() =>
        page.evaluate(() => document.activeElement?.closest("[data-coach-review]") !== null),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(page.locator("[data-coach-review]")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  });

  test("深化阶段:小卡渲染固定三维模板,完成点亮、未完保持幽灵", async ({ page }) => {
    await completeThreeActs(page);
    await page.locator("[data-artifact-entry]").click();
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[0].question }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.locator("[data-coach-progress-deepening]")).toBeVisible();
    for (let index = 0; index < 3; index += 1) {
      await expect(
        page.locator(`[data-coach-slot="deepening-${index}"]`),
      ).toHaveAttribute("data-coach-slot-filled", "false");
    }

    await submitCoachAnswer(page, DEEPENING_ANSWERS[0]);
    await expect(
      page.getByRole("heading", { name: coachDemoArtifactActs[1].question }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-coach-slot="deepening-0"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "true",
    );
    await expect(page.locator('[data-coach-slot="deepening-1"]')).toHaveAttribute(
      "data-coach-slot-filled",
      "false",
    );
  });
});

test.describe("打磨轮⑥:无障碍与窄屏", () => {
  test("Axe:双栏问题态与回看抽屉开态零自动化可检测违规", async ({ page }) => {
    await page.goto("/start");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    /* 作答一次让回看接替指南出口,再开抽屉扫描 */
    await submitCoachAnswer(page, ANSWERS[0]);
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await page.locator("[data-coach-review-trigger]").click();
    await expect(page.locator("[data-coach-review]")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test("375×812:进度条形态在场,零横向溢出且回答器仍在视口内", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/start");
    // 建立拍同样满足固定视口宪法:零横向溢出且一屏放得下
    const introMetrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(introMetrics.overflow).toBeLessThanOrEqual(0);
    expect(introMetrics.documentHeight).toBeLessThanOrEqual(introMetrics.viewportHeight + 1);
    await beginCoach(page);
    await expect(page.locator("[data-coach-progress]")).toBeVisible();
    await submitCoachAnswer(page, ANSWERS[0]);
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const composerBottom = await page.evaluate(() => {
      const composer = document.querySelector(".coach-composer");
      return composer?.getBoundingClientRect().bottom ?? Infinity;
    });
    expect(composerBottom).toBeLessThanOrEqual(812 + 1);
  });
});

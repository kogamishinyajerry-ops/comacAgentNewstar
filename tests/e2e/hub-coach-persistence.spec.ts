import { expect, test } from "@playwright/test";
import { beginCoach, submitCoachAnswer } from "./helpers";

/**
 * §35:会话持久化(sessionStorage,session-only)与顶栏跳转移除的行为验收。
 * 表达以下失败模式:
 * - 离开工作台(/guide)或刷新后进度丢失(用户原始投诉:"一点击跳转就所有信息都损失");
 * - 恢复后不给诚实提示,或提示不消失;
 * - 顶栏仍残留可跳转链接(返回指南/换入口),旅程中可自行乱跳;
 * - 回看(会话历史)不是在第一幕起就可用;
 * - 建立拍次要入口切换失效,/ 与 /start 不共享进度;
 * - 「重新开始」后旧快照残留(重新载入又回到旧进度)。
 */

const QUESTIONS = [
  "你最想改变的具体工作瞬间是什么？",
  "这个问题对谁造成了什么具体损失？",
  "为什么普通大模型聊天不足以解决它？",
] as const;

const ANSWERS = [
  "试验异常记录分散在三处,对账要来回翻找",
  "影响试验工程师与复核人,每次对账约多花两小时",
  "需要记住项目口径,按固定流程调用检索工具逐步核对并留痕",
] as const;

const RESTORED = "已恢复本次会话的进度。";

test.describe("§35:会话持久化与顶栏跳转移除", () => {
  test("答到第二幕后离开去 /guide 再回来:进度恢复并给一次性诚实提示", async ({ page }) => {
    await page.goto("/");
    await beginCoach(page);
    await submitCoachAnswer(page, ANSWERS[0]);
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });

    /* 会话快照键:版本+入口,/ 与 /start 共键 */
    await expect
      .poll(() =>
        page.evaluate(() => window.sessionStorage.getItem("coach-flow:v1:problem") !== null),
      )
      .toBe(true);

    /* 离开工作台再回来:进度不丢,直接落在第二幕 */
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: "你的下一步" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-coach-restored]")).toHaveText(RESTORED);

    /* 会话历史同步恢复:回看抽屉里有第一幕完整问答 */
    await page.locator("[data-coach-review-trigger]").click();
    await expect(page.locator("[data-coach-review]")).toBeVisible();
    await expect(page.locator("[data-coach-review-item]")).toHaveCount(1);
    await expect(
      page.locator("[data-coach-review]").getByText(ANSWERS[0]),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    /* 一次性提示:下一次提交后消失 */
    await submitCoachAnswer(page, ANSWERS[1]);
    await expect(page.locator("[data-coach-restored]")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: QUESTIONS[2] })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("刷新页面同样恢复进度;/ 与 /start 共享同一会话", async ({ page }) => {
    await page.goto("/start");
    await beginCoach(page);
    await submitCoachAnswer(page, ANSWERS[0]);
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-coach-restored]")).toHaveText(RESTORED);

    /* /start 的进度在 / 同样可见(共键) */
    await page.goto("/");
    await expect(page.getByRole("heading", { name: QUESTIONS[1] })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("顶栏无任何跳转链接;回看从第一幕(尚无回答)即可用", async ({ page }) => {
    await page.goto("/start");
    await beginCoach(page);
    await expect(page.getByRole("heading", { name: QUESTIONS[0] })).toBeVisible();

    /* 顶栏不渲染返回指南链接与入口切换(整个旅程都不再有) */
    await expect(page.getByRole("link", { name: /返回活动指南/ })).toHaveCount(0);
    await expect(page.locator("[data-coach-entry-switch]")).toHaveCount(0);

    /* 会话历史入口第一幕即在场,零回答也能打开抽屉;指南链接在抽屉页脚常驻 */
    const trigger = page.locator("[data-coach-review-trigger]");
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.locator("[data-coach-review]")).toBeVisible();
    await expect(page.locator("[data-coach-review-item]")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /回到活动指南/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
  });

  test("建立拍次要入口链接切到 ?entry=idea(零成本起点决策)", async ({ page }) => {
    await page.goto("/");
    const switchLink = page.locator("[data-coach-entry-switch]");
    await expect(switchLink).toHaveText("从已有想法开始 →");
    await switchLink.click();
    await expect(page).toHaveURL(/\?entry=idea/);

    /* idea 入口的建立拍提供反向切换;问题文案切换到 idea 序列 */
    await page.locator("[data-coach-begin]").waitFor({ state: "visible" });
    await expect(page.locator("[data-coach-entry-switch]")).toHaveText("从真实问题开始 →");
    await beginCoach(page);
    await expect(
      page.getByRole("heading", { name: "先不要描述功能。你观察到的真实问题是什么？" }),
    ).toBeVisible();
  });

  test("「重新开始」清除会话快照:刷新后回到建立拍而不是旧进度", async ({ page }) => {
    await page.goto("/start");
    await beginCoach(page);
    for (const [index, question] of QUESTIONS.entries()) {
      await expect(page.getByRole("heading", { name: question })).toBeVisible({
        timeout: 15_000,
      });
      await submitCoachAnswer(page, ANSWERS[index]);
    }
    await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "重新开始" }).click();
    await page.locator("[data-coach-begin]").waitFor({ state: "visible" });

    /* 重开后刷新:不得恢复旧进度(快照已是全新初始态) */
    await page.reload();
    await page.locator("[data-coach-begin]").waitFor({ state: "visible" });
    await expect(page.locator("[data-coach-restored]")).toHaveCount(0);
  });
});

import { expect, test, type Page } from "@playwright/test";

/**
 * 问题种子导出:三幕凝结的种子可复制为纯文本;复制只在浏览器本地发生,
 * 不新增持久化。成功与失败路径都要有可访问反馈(role="status")。
 */

async function completeThreeActs(page: Page) {
  await page.goto("/start");
  for (let act = 0; act < 3; act += 1) {
    const responder = page.locator("#coach-answer");
    await expect(responder).toBeVisible({ timeout: 15_000 });
    await responder.fill(`第${act + 1}幕:试验异常记录分散在三处,工程师对账每次多花两小时,需按流程调用工具留痕。`);
    await page.getByRole("button", { name: "提交这一问的回答" }).click();
  }
  await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 15_000 });
}

test.describe("问题种子导出", () => {
  test("三幕完成后一键复制种子纯文本,反馈可访问", async ({ page }) => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await completeThreeActs(page);

    await page.getByRole("button", { name: "复制问题种子" }).click();
    await expect(page.locator("[data-seed-copy-status]")).toHaveText(/已复制/);

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("问题种子");
    expect(text).toContain("【主张】");
    expect(text).toContain("【证据】");
    expect(text).toContain("【缺口】");
    expect(text).toContain("试验异常记录分散在三处");
    expect(text).toContain("◇ ");
  });

  test("剪贴板被拒时给出失败反馈,不阻塞主 CTA", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: () => Promise.reject(new Error("denied")) },
        configurable: true,
      });
    });
    await completeThreeActs(page);

    await page.getByRole("button", { name: "复制问题种子" }).click();
    await expect(page.locator("[data-seed-copy-status]")).toHaveText(/复制失败/);
    await expect(page.getByRole("link", { name: "了解完整实践路径" })).toBeVisible();
  });

  test("指南页显式引导种子导出并如实说明开放条件(§23 A1)", async ({ page }) => {
    await page.goto("/guide");

    /* guide-next 是 h2 的 id;caption 在由它标注的 section 内 */
    const next = page.locator("section[aria-labelledby='guide-next']");
    await expect(next).toBeVisible();
    await expect(next).toContainText("可复制带走的问题种子");
    await expect(next).toContainText("将在活动配置确认后开放");
  });
});

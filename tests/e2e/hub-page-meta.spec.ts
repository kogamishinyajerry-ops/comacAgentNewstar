import { expect, test } from "@playwright/test";

/**
 * 公共页独立 metadata:对外门户各页应有独立标题与描述,
 * 不与根布局共用一个标题;内部验收页 /dev 通过 robots.txt 排除索引。
 * 活动未确认事实(日期/链接/主办)不得出现在 meta 中。
 */

test.describe("公共页 metadata", () => {
  test("首页沿用根 metadata 并带 openGraph 基础字段", async ({ page }) => {
    await page.goto("/");
    const title = await page.title();
    expect(title.trim().length).toBeGreaterThan(0);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /.+/);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "zh_CN");
  });

  test("/start 有独立的问题探索标题与描述", async ({ page }) => {
    await page.goto("/start");
    await expect(page).toHaveTitle(/问题探索 · /);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /三幕式 AI Coach/
    );
  });

  test("/guide 与三个角色页各有独立标题", async ({ page }) => {
    for (const [path, keyword] of [
      ["/guide", "活动指南"],
      ["/role/participant", "参赛者"],
      ["/role/reviewer", "评委"],
      ["/role/organizer", "组织者"],
    ] as const) {
      await page.goto(path);
      await expect(page).toHaveTitle(new RegExp(`${keyword} · `));
    }
  });

  test("robots.txt 允许公共页并排除内部验收页", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBeTruthy();
    const body = await res.text();
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /dev/");
  });

  test("基础安全响应头在场：防嗅探、防嵌套、收敛引用来源", async ({ request }) => {
    const res = await request.get("/");
    expect(res.ok()).toBeTruthy();
    const headers = res.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
  });
});

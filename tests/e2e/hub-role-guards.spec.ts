import { test, expect, type Page } from "@playwright/test";

const DEMO_PASSWORD = "demo1234";

async function signIn(page: Page, email: string, expectedPath: RegExp) {
  await page.goto("/login");
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(expectedPath);
}

async function expectWorkspaceAccessDenied(page: Page, href: "/judge" | "/organizer", workspaceTitle: string) {
  await page.goto(href);

  // 旧侧的 requireRole 会将不具备角色的已登录用户送回公共 Hub，而不是渲染受保护工作区。
  await expect(page).toHaveURL(/\/(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: workspaceTitle })).toHaveCount(0);
}

test.describe("公共 Hub 交接到旧侧工作区时的既有 RBAC 守卫", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("已登录参赛者不能进入评委或组织者工作区", async ({ page }) => {
    await signIn(page, "alice@demo.com", /\/projects(?:\?.*)?$/);

    await expectWorkspaceAccessDenied(page, "/judge", "评委工作台");
    await expectWorkspaceAccessDenied(page, "/organizer", "组织者仪表盘");
  });

  test("已登录评委不能进入组织者工作区", async ({ page }) => {
    await signIn(page, "judge1@demo.com", /\/judge(?:\?.*)?$/);

    await expectWorkspaceAccessDenied(page, "/organizer", "组织者仪表盘");
  });
});

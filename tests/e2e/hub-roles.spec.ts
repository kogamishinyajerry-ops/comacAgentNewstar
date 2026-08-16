import { test, expect, type Page } from "@playwright/test";

function publicHubBoundary(roleKey: "participant" | "reviewer" | "organizer") {
  const access = roleKey === "participant"
    ? "目标入口会校验你的账户。"
    : "目标入口会校验你的账户与既有角色权限。";
  return `${access}公共 Hub 不读取、不展示项目、评分或管理数据，也不执行管理动作。`;
}

async function expectProtectedHandoff(
  page: Page,
  roleKey: "participant" | "reviewer" | "organizer",
  label: string,
  href: "/projects" | "/judge" | "/organizer"
) {
  const handoff = page.locator(`[data-role-handoff="${roleKey}"]`);

  await expect(handoff).toBeVisible();
  await expect(handoff.getByRole("heading", { name: "下一步在受保护的工作区完成" })).toBeVisible();
  await expect(handoff.getByText(publicHubBoundary(roleKey), { exact: true })).toBeVisible();
  await expect(handoff.getByRole("link", { name: label })).toHaveAttribute("href", href);
}

test.describe("公共 Hub 的角色工作区交接", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("参赛者先做问题探索，再以次级入口交接到既有工作区", async ({ page }) => {
    await page.goto("/role/participant");

    const exploration = page.getByRole("link", { name: "开始一次问题探索" });
    await expect(exploration).toHaveAttribute("href", "/start");
    await expect(exploration).toHaveClass(/hub-btn--primary/);

    await expectProtectedHandoff(
      page,
      "participant",
      "进入受保护的参赛者工作区",
      "/projects"
    );
    await expect(
      page.getByRole("link", { name: "进入受保护的参赛者工作区" })
    ).toHaveClass(/hub-btn--secondary/);
    await expect(page.locator('a[href="/workbuddy"]')).toHaveCount(0);
  });

  test("评委仅交接到受保护的 JUDGE 工作区，不出现评分界面", async ({ page }) => {
    await page.goto("/role/reviewer");

    await expectProtectedHandoff(page, "reviewer", "进入受保护的评委工作区", "/judge");
    await expect(page.getByRole("button", { name: /评分|打分|提交评审|保存评审/ })).toHaveCount(0);
    await expect(page.locator("input, textarea, select")).toHaveCount(0);
    await expect(page.locator('a[href="/workbuddy"]')).toHaveCount(0);
  });

  test("组织者仅交接到受保护工作区，不出现指标、事件或控制界面", async ({ page }) => {
    await page.goto("/role/organizer");

    await expectProtectedHandoff(page, "organizer", "进入受保护的组织者工作区", "/organizer");
    const handoff = page.locator('[data-role-handoff="organizer"]');
    await expect(handoff.getByRole("link", { name: "查看 WorkBuddy 受保护入口" })).toHaveAttribute(
      "href",
      "/workbuddy"
    );
    await expect(handoff.getByRole("link", { name: "查看 WorkBuddy 受保护入口" })).toHaveClass(
      /hub-btn--ghost/
    );
    await expect(page.getByRole("button", { name: /执行|批准|拒绝|发布|变更状态|发送通知/ })).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(page.getByText(/完成率|项目总数|事件流|健康分/)).toHaveCount(0);
  });

  test("三个交接目标在匿名访问时仍由旧侧登录守卫处理", async ({ page }) => {
    for (const href of ["/projects", "/judge", "/organizer"] as const) {
      await page.goto(href);
      await expect(page).toHaveURL(/\/login/);
    }
  });
});

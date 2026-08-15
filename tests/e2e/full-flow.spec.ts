import { test, expect } from "@playwright/test";

/**
 * 核心验收E2E:注册→组队→新建想法→10步向导起步→Agent诊断(Mock)。
 * 运行:npx playwright test(首次需 npx playwright install chromium)
 * 注意:默认无GLM Key时自动走Mock Provider;设置 LLM_MOCK_MODE=true 可强制。
 */

const uniq = Date.now();

test("注册→建队→新建想法→第1步勾选前进", async ({ page }) => {
  await page.goto("/register");
  await page.getByPlaceholder("真实姓名或常用昵称").fill(`甲${uniq}`);
  await page.locator('input[type="email"]').fill(`a${uniq}@t.cn`);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // 创建队伍
  await page.goto("/projects/new-team");
  await page.getByPlaceholder("例如:艾的实验小队").fill(`队${uniq}`);
  await page.getByRole("button", { name: "创建队伍" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // 新建想法(页面顶栏与空状态各有一个入口)
  await page.getByRole("button", { name: "+ 新建想法" }).first().click();
  await page.getByPlaceholder("想法名称,如:变更对比说明小助手").fill("E2E测试想法");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(/step=1/);

  // 第1步:三项合规勾选后前进
  const boxes = page.locator('input[type="checkbox"]');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await boxes.nth(2).check();
  await page.getByRole("button", { name: "下一步 →" }).click();
  await expect(page.getByText("原创与公平披露")).toBeVisible();
  await expect(page.locator("code").first()).toBeVisible(); // 邀请码
});

test("第三人无法加入已满2人队伍", async ({ request }) => {
  await request.post("/api/auth/register", {
    data: { name: `丙${uniq}`, email: `c${uniq}@t.cn`, password: "password123" },
  });
  // 种子数据中的双人队"问答双子"(邀请码 E5F6G7H8)已满2人
  const join = await request.post("/api/teams/join", {
    data: { inviteCode: "E5F6G7H8", seatRole: "ECHO" },
  });
  expect(join.status()).toBe(409);
  expect((await join.json()).error).toContain("已满2人");
});

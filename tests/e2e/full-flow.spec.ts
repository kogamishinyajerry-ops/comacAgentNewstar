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

  // 工作台空状态:先建队
  await expect(page.getByText("从一个真实的小麻烦开始")).toBeVisible();

  // 创建队伍
  await page.goto("/projects/new-team");
  await page.getByPlaceholder("例如:艾的实验小队").fill(`队${uniq}`);
  await page.getByRole("button", { name: "创建队伍" }).click();
  await expect(page).toHaveURL(/\/projects/);

  // 新建想法(建队后出现在工作台)→ 进入对话式工作台
  await page.getByRole("button", { name: "+ 新建想法" }).click();
  await page.getByPlaceholder("想法名称,如:变更对比说明小助手").fill("E2E测试想法");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText("我不打算给你一张表格")).toBeVisible();

  // 对话即填写:同意承诺 → 材料被记录
  const ta = page.getByPlaceholder("用你自己的说说——我在听,也在记录").or(page.getByPlaceholder("用你自己的话说——我在听,也在记录"));
  await ta.fill("同意");
  await ta.press("Enter");
  await expect(page.getByText("三条底线确认", { exact: false })).toBeVisible({ timeout: 8000 });
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

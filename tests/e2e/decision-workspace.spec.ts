import { test, expect } from "@playwright/test";

const uniq = Date.now();

test("Agent 提议→人工批准→Coach 复核→人工签收形成可追溯 Artifact", async ({ page }) => {
  await page.goto("/register");
  await page.getByPlaceholder("真实姓名或常用昵称").fill(`协作验收${uniq}`);
  await page.locator('input[type="email"]').fill(`decision${uniq}@t.cn`);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page).toHaveURL(/\/projects/);

  await page.goto("/projects/new-team");
  await page.getByPlaceholder("例如:艾的实验小队").fill(`Decision队${uniq}`);
  await page.getByRole("button", { name: "创建队伍" }).click();

  await page.getByRole("button", { name: "+ 新建想法" }).click();
  await page.getByPlaceholder("想法名称,如:变更对比说明小助手").fill("可信协作闭环验收");
  await page.getByRole("button", { name: "创建", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/chat$/);

  const projectId = page.url().match(/\/projects\/([^/]+)\/chat$/)?.[1];
  expect(projectId).toBeTruthy();
  await page.goto(`/projects/${projectId}`);

  await expect(page.getByRole("region", { name: "Agent 协作决策工作台" })).toBeVisible();
  await expect(page.getByText("不是功能菜单，是决定顺序")).toBeVisible();
  await expect(page.getByRole("link", { name: "进入高级工作台 ↗" })).toBeVisible();
  await expect(page.getByText("Agent：仅建议")).toBeVisible();

  await page.getByRole("button", { name: "请求本阶段诊断" }).click();
  await expect(page.getByText("先读一遍红线")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("重点看求证闭环与数据安全两条红线")).toBeVisible();
  await expect(page.getByRole("button", { name: /依据 1/ })).toBeVisible();

  await page.getByRole("button", { name: "接受并写入 Artifact" }).click();
  await expect(page.getByText("已记录：你批准了 Agent 提议", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "让 Coach 复核" })).toBeVisible();
  await expect(page.getByText("写入 Artifact", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "让 Coach 复核" }).click();
  await expect(page.getByText("Coach 已完成一次新的阶段复核", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "确认签收" })).toBeVisible();

  await page.getByRole("button", { name: "确认签收" }).click();
  await expect(page.getByText("已签收", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("你已完成最终签收", { exact: false })).toBeVisible();
  await expect(page.getByText("协作验收", { exact: false })).toBeVisible();

  await page.getByText("Evidence & Run Trace", { exact: true }).click();
  await expect(page.getByText("Agent Run", { exact: true })).toBeVisible();
  await expect(page.getByText("系统：只按确认动作写入阶段 JSON")).toBeVisible();
});

test("高级工作台仍可作为完整编辑与回退界面", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(`decision${uniq}@t.cn`);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page).toHaveURL(/\/projects/);

  await page.getByText("可信协作闭环验收").click();
  await expect(page.getByRole("link", { name: "进入高级工作台 ↗" })).toBeVisible();
  await page.getByRole("link", { name: "进入高级工作台 ↗" }).click();

  await expect(page).toHaveURL(/view=advanced/);
  await expect(page.getByText("规则与数据承诺", { exact: true })).toBeVisible();
  await expect(page.getByText("10 步", { exact: false }).or(page.getByText("第1步", { exact: false }))).toBeVisible();
});

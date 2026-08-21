import { test, expect, type Page } from "@playwright/test";

const uniq = Date.now();

async function registerProject(
  page: Page,
  suffix: string,
  projectTitle: string,
): Promise<string> {
  await page.goto("/register");
  await page.getByPlaceholder("真实姓名或常用昵称").fill(`协作验收${suffix}`);
  await page.locator('input[type="email"]').fill(`decision-${suffix}@t.cn`);
  await page.locator('input[type="password"]').fill("password123");
  await page.getByRole("button", { name: "注册并开始" }).click();
  await expect(page).toHaveURL(/\/projects/);

  const teamResponse = await page.request.post("/api/teams", {
    data: { name: `Decision队${suffix}`.slice(0, 30), mode: "SOLO" },
  });
  expect(teamResponse.ok()).toBeTruthy();

  const projectResponse = await page.request.post("/api/projects", {
    data: { title: projectTitle },
  });
  expect(projectResponse.ok()).toBeTruthy();
  const payload = (await projectResponse.json()) as { projectId?: string };
  expect(payload.projectId).toBeTruthy();
  return payload.projectId as string;
}

test("Agent 提议→人工批准→Coach 复核→人工签收形成可追溯 Artifact", async ({ page }) => {
  const projectId = await registerProject(page, `${uniq}-golden`, "可信协作闭环验收");
  await page.goto(`/projects/${projectId}`);

  await expect(page.getByRole("region", { name: "Agent 协作决策工作台" })).toBeVisible();
  await expect(page.getByText("不是功能菜单，是决定顺序")).toBeVisible();
  await expect(page.getByRole("link", { name: "进入高级工作台 ↗" })).toBeVisible();
  await expect(page.getByText("Agent：仅建议")).toBeVisible();

  await page.getByRole("button", { name: "请求本阶段诊断" }).click();
  await expect(page.getByText("先读一遍红线")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("重点看求证闭环与数据安全两条红线", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /依据 1/ })).toBeVisible();

  await page.getByRole("button", { name: "接受并写入 Artifact" }).click();
  await expect(page.getByText("已记录：你批准了 Agent 提议", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "让 Coach 复核" })).toBeVisible();
  await expect(page.getByLabel("AI Coach 决策区").getByText("已写入 Artifact", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "让 Coach 复核" }).click();
  await expect(page.getByText("Coach 已完成一次新的阶段复核", { exact: false })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "确认签收" })).toBeVisible();

  await page.getByRole("button", { name: "确认签收" }).click();
  await expect(page.getByLabel("AI Coach 决策区").getByText("已签收", { exact: true })).toBeVisible();
  await expect(page.getByText("你已完成最终签收", { exact: false })).toBeVisible();
  await expect(page.getByText(/协作验收.*签收/)).toBeVisible();

  await page.getByText("Evidence & Run Trace", { exact: true }).click();
  await expect(page.getByText("Agent Run", { exact: true })).toBeVisible();
  await expect(page.getByText("系统：只按确认动作写入阶段 JSON")).toBeVisible();
});

test("高级工作台仍可作为完整编辑与回退界面", async ({ page }) => {
  const projectId = await registerProject(page, `${uniq}-advanced`, "高级工作台回退验收");
  await page.goto(`/projects/${projectId}`);

  await expect(page.getByRole("link", { name: "进入高级工作台 ↗" })).toBeVisible();
  await page.getByRole("link", { name: "进入高级工作台 ↗" }).click();

  await expect(page).toHaveURL(/view=advanced/);
  await expect(page.getByText("规则与数据承诺", { exact: true })).toBeVisible();
  await expect(page.getByText("10 步", { exact: false }).or(page.getByText("第1步", { exact: false }))).toBeVisible();
});

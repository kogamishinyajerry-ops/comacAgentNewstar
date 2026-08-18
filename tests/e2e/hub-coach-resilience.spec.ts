import { expect, test, type Page, type Route } from "@playwright/test";

const fixtureQuestions = [
  "你最想改变的具体工作瞬间是什么?",
  "这个问题对谁造成了什么具体损失?",
  "为什么普通大模型聊天不足以解决它?",
] as const;

const fallbackNotice = "AI 服务暂不可用，本幕已按确定性追问继续。";

type FailureMode = {
  name: string;
  hiddenDiagnostic: string;
  reply: (route: Route) => Promise<void>;
};

const failureModes: readonly FailureMode[] = [
  {
    name: "500 响应",
    hiddenDiagnostic: "provider-stack-trace-should-never-reach-the-user",
    reply: (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "provider-stack-trace-should-never-reach-the-user" }),
      }),
  },
  {
    name: "请求中断",
    hiddenDiagnostic: "network-abort-detail-should-never-reach-the-user",
    reply: (route) => route.abort("failed"),
  },
  {
    name: "畸形 JSON",
    hiddenDiagnostic: "malformed-payload-detail-should-never-reach-the-user",
    reply: (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"error":"malformed-payload-detail-should-never-reach-the-user"',
      }),
  },
];

async function submitAnswer(page: Page, answer: string) {
  await page.locator("#coach-answer").fill(answer);
  await page.getByRole("button", { name: "提交这一问的回答" }).click();
}

async function expectFixtureScene(page: Page, question: string) {
  await expect(page.getByRole("heading", { name: question })).toBeVisible({ timeout: 8_000 });
}

test.describe("Hub Coach 浏览器级韧性", () => {
  for (const failure of failureModes) {
    test(`接口${failure.name}时保留确定性三幕、解除 pending 且不暴露诊断`, async ({ page }) => {
      let interceptedRequests = 0;
      await page.route("**/api/hub/coach", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        interceptedRequests += 1;
        await failure.reply(route);
      });

      await page.goto("/start?entry=problem");
      const stage = page.locator(".coach-stage");
      const answer = page.locator("#coach-answer");
      const submit = page.getByRole("button", { name: "提交这一问的回答" });

      await expectFixtureScene(page, fixtureQuestions[0]);
      await submitAnswer(page, "试验异常记录分散在多处，复核时常常找不到对应依据。");
      await expect(stage).toHaveAttribute("aria-busy", "true");
      // 过渡期 Composer 整体折叠,不留禁用的大输入框占据视觉中心
      await expect(page.locator(".coach-composer")).toHaveCount(0);
      await expect(answer).toHaveCount(0);

      // 下一幕端上后回答器恢复,可继续输入与提交
      await expectFixtureScene(page, fixtureQuestions[1]);
      await expect(stage).toHaveAttribute("aria-busy", "false");
      await expect(answer).toBeEnabled();
      await expect(submit).toBeEnabled();
      await expect(page.locator('[role="alert"]', { hasText: fallbackNotice })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(failure.hiddenDiagnostic);

      await submitAnswer(page, "影响试验工程师和复核人；每次对账多花两小时，版本对不上还会返工。");
      await expect(stage).toHaveAttribute("aria-busy", "true");
      await expect(page.locator(".coach-composer")).toHaveCount(0);
      await expectFixtureScene(page, fixtureQuestions[2]);
      await expect(stage).toHaveAttribute("aria-busy", "false");
      await expect(answer).toBeEnabled();
      await expect(submit).toBeEnabled();
      await expect(page.locator('[role="alert"]', { hasText: fallbackNotice })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(failure.hiddenDiagnostic);

      await submitAnswer(page, "需要长期记住项目上下文、调用多个信息源，并按固定流程多步检查和保留痕迹。");
      await expect(page.getByText("问题种子", { exact: true })).toBeVisible({ timeout: 8_000 });
      expect(interceptedRequests).toBe(2);
    });
  }

  test("限流超限的无 act fixture 信号：客户端回落本地确定性追问且不出现错误告警", async ({ page }) => {
    await page.route("**/api/hub/coach", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, mode: "fixture" }),
      })
    );

    await page.goto("/start?entry=problem");
    await submitAnswer(page, "试验异常记录分散在多处，复核时常常找不到对应依据。");

    // 下一问来自本地 fixture,三幕照常推进
    await expectFixtureScene(page, fixtureQuestions[1]);
    await expect(page.getByText("这一幕沿用确定性追问。")).toBeVisible();
    // 这不是失败路径:不出现断网式回退告警
    await expect(page.locator('[role="alert"]', { hasText: fallbackNotice })).toHaveCount(0);
  });

  test("HTTP API 拒绝跨源 Origin，且不回显请求内容", async ({ request }) => {
    const secretInput = "cross-origin-private-input-must-not-be-returned";
    const response = await request.post("/api/hub/coach", {
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      data: {
        entry: "problem",
        completedAct: 0,
        answers: [secretInput],
      },
    });

    expect(response.status()).toBe(403);
    const body = await response.text();
    expect(body).not.toContain(secretInput);
    expect(JSON.parse(body)).toEqual({ ok: false, error: "请求来源不正确" });
  });
});

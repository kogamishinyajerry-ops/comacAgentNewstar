import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { coachDemoActs } from "../fixtures/coach-demo";
import { resetHubCoachRateLimiterForTests } from "../lib/hub/coach-provider";
import { POST } from "../app/api/hub/coach/route";
import {
  hubCoachRequestClientKey,
  isSameOriginHubCoachRequest,
} from "../lib/hub/coach-request";

const originalMockMode = process.env.LLM_MOCK_MODE;
const originalApiKey = process.env.GLM_API_KEY;
const originalTrustedProxy = process.env.HUB_COACH_TRUST_PROXY;

function request(body: unknown, headers: HeadersInit = {}) {
  return new Request("http://localhost/api/hub/coach", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
      "x-forwarded-for": "203.0.113.17",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/hub/coach", () => {
  beforeEach(() => {
    process.env.LLM_MOCK_MODE = "true";
    delete process.env.GLM_API_KEY;
    delete process.env.HUB_COACH_TRUST_PROXY;
    resetHubCoachRateLimiterForTests();
  });

  afterEach(() => {
    if (originalMockMode === undefined) delete process.env.LLM_MOCK_MODE;
    else process.env.LLM_MOCK_MODE = originalMockMode;
    if (originalApiKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalApiKey;
    if (originalTrustedProxy === undefined) delete process.env.HUB_COACH_TRUST_PROXY;
    else process.env.HUB_COACH_TRUST_PROXY = originalTrustedProxy;
    resetHubCoachRateLimiterForTests();
  });

  it("拒绝缺失或跨站 Origin 的请求，且默认不信任可伪造的 X-Forwarded-For", () => {
    const body = {
      entry: "problem",
      completedAct: 0,
      answers: ["试验异常记录分散在多处，复核时常常找不到对应依据。"],
    };
    const missingOrigin = new Request("http://localhost/api/hub/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    expect(isSameOriginHubCoachRequest(missingOrigin)).toBe(false);
    expect(isSameOriginHubCoachRequest(request(body, { origin: "https://attacker.example" }))).toBe(false);
    expect(hubCoachRequestClientKey(request(body, { "x-forwarded-for": "198.51.100.1" }))).toBe(
      hubCoachRequestClientKey(request(body, { "x-forwarded-for": "203.0.113.99" })),
    );
  });

  it("只在显式信任的 Cloudflare 边界使用其清洗后的客户端地址", () => {
    const body = { entry: "problem", completedAct: 0, answers: ["一次足够具体的回答。"] };
    process.env.HUB_COACH_TRUST_PROXY = "true";

    expect(hubCoachRequestClientKey(request(body, { "cf-connecting-ip": "203.0.113.17" }))).not.toBe(
      hubCoachRequestClientKey(request(body, { "cf-connecting-ip": "203.0.113.18" })),
    );
    expect(hubCoachRequestClientKey(request(body, { "x-forwarded-for": "203.0.113.17" }))).toBe(
      hubCoachRequestClientKey(request(body, { "x-forwarded-for": "203.0.113.18" })),
    );
  });

  it("只接受已完成第一或第二幕的精确回答数量，并返回安全的下一幕形状", async () => {
    const response = await POST(
      request({
        entry: "problem",
        completedAct: 0,
        answers: ["试验异常记录分散在多处，复核时常常找不到对应依据。"],
      })
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(Object.keys(payload).sort()).toEqual(["act", "mode", "ok"]);
    expect(payload).toEqual({ ok: true, mode: "fixture", act: coachDemoActs.problem[1] });
  });

  it("拒绝越界幕次、错误答案数量、空白和超过 600 字的输入，不回显原始内容", async () => {
    const invalidBodies = [
      { entry: "problem", completedAct: 2, answers: ["a", "b", "c"] },
      { entry: "problem", completedAct: 1, answers: ["只有一幕回答"] },
      { entry: "idea", completedAct: 0, answers: ["   "] },
      { entry: "idea", completedAct: 0, answers: ["很".repeat(601)] },
    ];

    for (const body of invalidBodies) {
      const response = await POST(request(body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ ok: false, error: "请求格式不正确" });
    }
  });

  it("对跨站请求返回通用错误，且不调用 Coach 路径", async () => {
    const response = await POST(request({
      entry: "problem",
      completedAct: 0,
      answers: ["试验异常记录分散在多处，复核时常常找不到对应依据。"],
    }, { origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "请求来源不正确" });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { coachDemoActs } from "../fixtures/coach-demo";

const { getHubCoachActMock } = vi.hoisted(() => ({
  getHubCoachActMock: vi.fn(),
}));

vi.mock("@/lib/hub/coach-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/hub/coach-provider")>();
  return { ...actual, getHubCoachAct: getHubCoachActMock };
});

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
    getHubCoachActMock.mockReset();
    getHubCoachActMock.mockResolvedValue({
      mode: "fixture",
      act: coachDemoActs.problem[1],
    });
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

  it("同一客户端到达第七次请求时在路由层安全回退 fixture，不再调用 Coach", async () => {
    const body = {
      entry: "problem",
      completedAct: 0,
      answers: ["试验异常记录分散在多处，复核时常常找不到对应依据。"],
    };
    getHubCoachActMock.mockResolvedValue({ mode: "live", act: coachDemoActs.problem[1] });

    const payloads = await Promise.all(
      Array.from({ length: 7 }, async () => (await POST(request(body))).json())
    );

    expect(payloads.slice(0, 6)).toEqual(
      Array.from({ length: 6 }, () => ({ ok: true, mode: "live", act: coachDemoActs.problem[1] }))
    );
    expect(payloads[6]).toEqual({ ok: true, mode: "fixture", act: coachDemoActs.problem[1] });
    expect(getHubCoachActMock).toHaveBeenCalledTimes(6);
  });

  it("受信代理下不同客户端耗尽全局预算时，第二十五次也在路由层安全回退 fixture", async () => {
    const body = {
      entry: "idea",
      completedAct: 0,
      answers: ["一个初步想法，但还缺少可验证的受益对象和证据。"],
    };
    process.env.HUB_COACH_TRUST_PROXY = "true";
    getHubCoachActMock.mockResolvedValue({ mode: "live", act: coachDemoActs.idea[1] });

    const payloads = [];
    for (let index = 1; index <= 25; index += 1) {
      const response = await POST(request(body, { "cf-connecting-ip": `203.0.113.${index}` }));
      payloads.push(await response.json());
    }

    expect(payloads.slice(0, 24)).toEqual(
      Array.from({ length: 24 }, () => ({ ok: true, mode: "live", act: coachDemoActs.idea[1] }))
    );
    expect(payloads[24]).toEqual({ ok: true, mode: "fixture", act: coachDemoActs.idea[1] });
    expect(getHubCoachActMock).toHaveBeenCalledTimes(24);
  });
});

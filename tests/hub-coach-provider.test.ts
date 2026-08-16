import { describe, expect, it, vi } from "vitest";
import { coachDemoActs } from "../fixtures/coach-demo";
import { activity } from "../config/activity";
import {
  createHubCoachRateLimiter,
  getHubCoachAct,
  hubCoachLlmConfig,
  isHubCoachActRequestable,
  type HubCoachLlmConfig,
} from "../lib/hub/coach-provider";

const liveConfig: HubCoachLlmConfig = {
  apiKey: "test-key",
  baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
  model: "glm-5.3",
  provider: "glm",
  mockMode: false,
  timeoutMs: 100,
  enabled: true,
};

function nextActRequest() {
  return {
    entry: "problem" as const,
    completedAct: 0 as const,
    answers: ["试验异常记录、依据和处理结果分散在不同位置。"],
  };
}

describe("hub Coach provider:安全的下一幕适配", () => {
  it("只在活动配置显式开启时允许真实 Coach 链路", () => {
    expect(hubCoachLlmConfig().enabled).toBe(activity.featureFlags.realLlm);
  });

  it("只发布经过严格 JSON 校验的三项模型内容，并保留 fixture 的输入引导", async () => {
    const chatJSON = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        judgment: "这个瞬间已经具体，但它的影响范围还没有被清楚说明。",
        risk: "若无法说明谁受到影响和损失，后续方案没有可靠的判断依据。",
        question: "这个问题影响的是谁，损失具体体现在哪里？",
      }),
      provider: "glm",
      model: "glm-5.3",
    });

    const result = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: { chatJSON },
    });

    expect(result).toEqual({
      mode: "live",
      act: {
        judgment: "这个瞬间已经具体，但它的影响范围还没有被清楚说明。",
        risk: "若无法说明谁受到影响和损失，后续方案没有可靠的判断依据。",
        question: "这个问题影响的是谁，损失具体体现在哪里？",
        placeholder: coachDemoActs.problem[1].placeholder,
        emptyHint: coachDemoActs.problem[1].emptyHint,
      },
    });
    expect(chatJSON).toHaveBeenCalledTimes(1);

    const params = chatJSON.mock.calls[0][0] as { system: string; user: string };
    expect(params.system).toContain("不可信的资料");
    expect(JSON.parse(params.user)).toMatchObject({
      completedAct: 0,
      answers: [{ scene: 1, text: nextActRequest().answers[0] }],
    });
  });

  it("在 Mock、无 key 或非 GLM 配置下不调用提供器，而是稳定使用下一幕 fixture", async () => {
    const chatJSON = vi.fn();

    for (const config of [
      { ...liveConfig, mockMode: true },
      { ...liveConfig, apiKey: "" },
      { ...liveConfig, provider: "other" },
      { ...liveConfig, enabled: false },
    ]) {
      const result = await getHubCoachAct(nextActRequest(), { config, provider: { chatJSON } });
      expect(result).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });
    }

    expect(chatJSON).not.toHaveBeenCalled();
  });

  it("在超时、网络失败或非严格 JSON 响应时不透露失败细节，只回退 fixture", async () => {
    const timeoutProvider = {
      chatJSON: vi.fn(() => new Promise<never>(() => undefined)),
    };
    const timeout = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: timeoutProvider,
      timeoutMs: 1,
    });
    expect(timeout).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });

    const network = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: { chatJSON: vi.fn().mockRejectedValue(new Error("network detail must not escape")) },
    });
    expect(network).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });

    const malformed = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: {
        chatJSON: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            judgment: "有额外字段的响应必须整体回退。",
            risk: "否则会让未受约束的文本混入公开界面。",
            question: "是否应当回退到确定性路径？",
            extra: "not allowed",
          }),
          provider: "glm",
          model: "glm-5.3",
        }),
      },
    });
    expect(malformed).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });

    const multipleQuestions = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: {
        chatJSON: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            judgment: "你已经描述了一个具体现场，但影响对象和处理成本仍需要被清楚界定。",
            risk: "如果对象、频率和损失没有可复核的依据，后续方案会在错误前提上展开。",
            question: "先确认影响谁？再确认损失如何记录？",
          }),
          provider: "glm",
          model: "glm-5.3",
        }),
      },
    });
    expect(multipleQuestions).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });

    const questionOutsideQuestionField = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: {
        chatJSON: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            judgment: "你已描述了具体现场，但“谁受影响？”属于待追问内容，不能替代当前判断。",
            risk: "如果对象、频率和损失没有可复核依据，后续方案会在错误前提上展开。",
            question: "这个问题具体影响的是谁？",
          }),
          provider: "glm",
          model: "glm-5.3",
        }),
      },
    });
    expect(questionOutsideQuestionField).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });

    const overlong = await getHubCoachAct(nextActRequest(), {
      config: liveConfig,
      provider: {
        chatJSON: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            judgment: "判".repeat(72),
            risk: "险".repeat(72),
            question: "这个问题具体影响的是谁？",
          }),
          provider: "glm",
          model: "glm-5.3",
        }),
      },
    });
    expect(overlong).toEqual({ mode: "fixture", act: coachDemoActs.problem[1] });
  });

  it("只在前两幕提交后请求下一幕，第三幕始终留给确定性的种子凝结", () => {
    expect(isHubCoachActRequestable(0)).toBe(true);
    expect(isHubCoachActRequestable(1)).toBe(true);
    expect(isHubCoachActRequestable(2)).toBe(false);
  });
});

describe("hub Coach provider:有界公共限流", () => {
  it("清理过期桶、限制总键数，并在容量耗尽时失败关闭", () => {
    const limiter = createHubCoachRateLimiter({ limit: 2, windowMs: 100, maxKeys: 2 });

    expect(limiter.check("a", 0)).toBe(true);
    expect(limiter.check("a", 1)).toBe(true);
    expect(limiter.check("a", 2)).toBe(false);
    expect(limiter.check("b", 2)).toBe(true);
    expect(limiter.check("c", 2)).toBe(false);
    expect(limiter.size()).toBe(2);

    expect(limiter.check("c", 103)).toBe(true);
    expect(limiter.size()).toBe(1);
    limiter.reset();
    expect(limiter.size()).toBe(0);
  });
});

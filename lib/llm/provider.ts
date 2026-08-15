// LLM Provider 抽象:统一接口,GLM 与 Mock 双实现;API Key 只在服务端存在

export interface ChatJSONParams {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatJSONResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  provider: string;
  model: string;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  chatJSON(params: ChatJSONParams): Promise<ChatJSONResult>;
}

export function llmConfig() {
  return {
    apiKey: process.env.GLM_API_KEY || "",
    baseUrl: (process.env.GLM_BASE_URL || "https://open.bigmodel.cn/api/coding/paas/v4").replace(/\/+$/, ""),
    model: process.env.GLM_MODEL || "glm-5.3",
    provider: process.env.LLM_PROVIDER || "glm",
    mockMode: process.env.LLM_MOCK_MODE === "true",
    // GLM-5.3 带思维链的完整诊断可能较慢,默认给足时间;可用 GLM_TIMEOUT_MS 覆盖
    timeoutMs: Number(process.env.GLM_TIMEOUT_MS) > 0 ? Number(process.env.GLM_TIMEOUT_MS) : 90_000,
    maxRetries: 1,
  };
}

export function isMockEnabled(): boolean {
  const c = llmConfig();
  return c.mockMode || !c.apiKey;
}

export function rateLimitKey(userId: string): string {
  return `llm:${userId}`;
}

// 简单内存速率限制:每用户每分钟 10 次调用
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(userId: string, limit = 10, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt < now) {
    buckets.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count += 1;
  return true;
}

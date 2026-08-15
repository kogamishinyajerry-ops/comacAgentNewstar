// GLM Provider:OpenAI 兼容的 chat/completions,超时+一次重试,Key 只存在服务端

import type { ChatJSONParams, ChatJSONResult, LLMProvider } from "./provider";
import { llmConfig } from "./provider";

interface GlmChoice {
  message?: { content?: string };
  finish_reason?: string;
}

interface GlmResponse {
  choices?: GlmChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class GLMProvider implements LLMProvider {
  readonly name = "glm";

  get model(): string {
    return llmConfig().model;
  }

  async chatJSON(params: ChatJSONParams): Promise<ChatJSONResult> {
    const cfg = llmConfig();
    const url = `${cfg.baseUrl}/chat/completions`;
    const body = JSON.stringify({
      model: cfg.model,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: params.temperature ?? 0.3,
      // 推理型模型的思维链会消耗大量token,上限必须留足,否则content为空
      max_tokens: params.maxTokens ?? 8000,
      response_format: { type: "json_object" },
    });

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`, // 仅服务端使用,不落日志
          },
          body,
          signal: controller.signal,
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          // 429/5xx 重试一次,其余直接失败
          if ((res.status === 429 || res.status >= 500) && attempt < cfg.maxRetries) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            continue;
          }
          throw new Error(`GLM HTTP ${res.status}:${errText.slice(0, 200)}`);
        }
        const data = (await res.json()) as GlmResponse;
        const choice = data.choices?.[0];
        const text = choice?.message?.content ?? "";
        if (!text) {
          throw new Error(
            choice?.finish_reason === "length"
              ? "GLM 输出被截断(思维链耗尽max_tokens),已调大上限或稍后重试"
              : "GLM 返回空内容"
          );
        }
        return {
          text,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          provider: this.name,
          model: cfg.model,
        };
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        // 超时不再重试:推理型模型慢是常态,重试只会翻倍等待,直接走降级
        if (lastError.name === "AbortError") throw lastError;
        if (attempt < cfg.maxRetries && /fetch|network|ECONN/i.test(lastError.message)) continue;
        throw lastError;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("GLM 调用失败");
  }
}

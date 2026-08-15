// JSON 提取与一次性修复:去掉代码围栏、截取首尾大括号、去除尾逗号

export function extractJsonCandidate(text: string): string | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return t.slice(start, end + 1);
}

/** 尝试解析;失败则做一次轻量修复(尾逗号、单引号键的常见错误不强行修复,避免引入歧义) */
export function tryParseJson(text: string, repair: boolean): unknown | null {
  const attempts: string[] = [];
  const direct = extractJsonCandidate(text);
  if (direct) attempts.push(direct);
  if (repair && direct) {
    attempts.push(direct.replace(/,\s*([}\]])/g, "$1"));
    // 未闭合的截断输出:补齐括号
    let fixed = direct.replace(/,\s*$/, "");
    const open = (fixed.match(/{/g) || []).length - (fixed.match(/}/g) || []).length;
    const openArr = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
    if (open > 0 || openArr > 0) {
      fixed = fixed + "]".repeat(Math.max(0, openArr)) + "}".repeat(Math.max(0, open));
      attempts.push(fixed);
    }
  }
  for (const a of attempts) {
    try {
      return JSON.parse(a);
    } catch {
      /* 尝试下一种 */
    }
  }
  return null;
}

/**
 * 形状矫正兜底:模型偶尔把 critical_gaps/suggestions 输出成字符串数组,
 * 或漏掉部分必填字段。在Schema校验前先归一化,提高真实模型的通过率。
 */
export function coerceFeedbackShape(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const obj = { ...(input as Record<string, unknown>) };
  const coerceGaps = (v: unknown) =>
    Array.isArray(v)
      ? v.map((g) =>
          typeof g === "string" ? { field: "-", reason: g } : g
        )
      : v;
  const coerceSuggestions = (v: unknown) =>
    Array.isArray(v)
      ? v.map((s) =>
          typeof s === "string"
            ? { title: s.slice(0, 30), action: s, why: "" }
            : typeof s === "object" && s !== null && !("action" in s) && ("reason" in (s as object) || "detail" in (s as object))
              ? { title: String((s as Record<string, unknown>).title ?? "建议"), action: String((s as Record<string, unknown>).reason ?? (s as Record<string, unknown>).detail ?? ""), why: "" }
              : s
        )
      : v;
  if ("critical_gaps" in obj) obj.critical_gaps = coerceGaps(obj.critical_gaps);
  if ("suggestions" in obj) obj.suggestions = coerceSuggestions(obj.suggestions);
  if (!("questions" in obj) || !Array.isArray(obj.questions)) obj.questions = [];
  if (!("risk_flags" in obj) || !Array.isArray(obj.risk_flags)) obj.risk_flags = [];
  if (!("stage_assessment" in obj)) obj.stage_assessment = "needs_revision";
  if (!("summary" in obj) || typeof obj.summary !== "string" || !obj.summary) {
    obj.summary = typeof obj.raw_feedback === "string" ? obj.raw_feedback.slice(0, 120) : "已完成预检分析。";
  }
  if (!("next_action" in obj) || typeof obj.next_action !== "string" || !obj.next_action) {
    obj.next_action = "按关键缺口逐项补充材料。";
  }
  if (!("can_continue" in obj) || typeof obj.can_continue !== "boolean") obj.can_continue = true;
  return obj;
}

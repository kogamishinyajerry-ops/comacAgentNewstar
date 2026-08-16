import { describe, expect, it } from "vitest";
import { chatInsight, type InsightMsg } from "../lib/chat-insight";

const m = (role: string, content: string, meta?: string): InsightMsg => ({ role, content, meta });

describe("chatInsight 对话形成过程洞察", () => {
  it("空历史 → 全零且无高亮", () => {
    const i = chatInsight([]);
    expect(i.turns).toBe(0);
    expect(i.fieldCount).toBe(0);
    expect(i.highlights).toHaveLength(0);
    expect(i.firstAt).toBeNull();
  });

  it("统计轮数/字段去重/口述落表/补预期", () => {
    const i = chatInsight([
      m("user", "同意"),
      m("agent", "三条底线确认", JSON.stringify({ updates: [{ step: 1, key: "agreeRules", value: true }] })),
      m("user", "新人查报销要翻三个文档"),
      m("agent", "已记录", JSON.stringify({ updates: [{ step: 4, key: "scenario", value: "x" }] })),
      m("user", "换个说法又讲了一遍"),
      m("agent", "已更新", JSON.stringify({ updates: [{ step: 4, key: "scenario", value: "y" }] })),
      m("user", "给它两份导出,期望出对比"),
      m("agent", "已落表", JSON.stringify({ updates: [{ step: 8, key: "testCase", value: { name: "常规例", type: "NORMAL", input: "i", expected: "e", failureReason: "" } }] })),
      m("user", "应该输出一页说明"),
      m("agent", "预期已补上", JSON.stringify({ updates: [{ step: 8, key: "testCaseExpected", value: "应该输出一页说明" }] })),
    ]);
    expect(i.turns).toBe(5);
    expect(i.fieldCount).toBe(2); // agreeRules + scenario(覆盖只算一次)
    expect(i.testsNarrated).toBe(1);
    expect(i.expectedFollowups).toBe(1);
    expect(i.grillAsked).toBe(0);
  });

  it("拷问计数:grill 后一条是用户消息才算已答,并产出高亮", () => {
    const i = chatInsight([
      m("user", "大概每周几次"),
      m("agent", "追问", JSON.stringify({ grill: { q: "「大概每周几次」是估的还是数过的?", why: "why" } })),
      m("user", "数过,每周3次"),
      m("agent", "已记录", JSON.stringify({ updates: [], grill: { q: "数据源换了还成立吗?", why: "" } })),
    ]);
    expect(i.grillAsked).toBe(2);
    expect(i.grillAnswered).toBe(1);
    expect(i.highlights).toEqual([{ q: "「大概每周几次」是估的还是数过的?", answer: "数过,每周3次" }]);
  });

  it("meta 支持已解析对象(chatHistory 直接传视图)与非法 JSON 容错", () => {
    const i = chatInsight([
      { role: "agent", content: "x", meta: { updates: [{ step: 5, key: "stopConditions", value: "y" }] } },
      m("agent", "bad", "{not json"),
    ]);
    expect(i.fieldCount).toBe(1);
  });

  it("首末时间取首尾消息", () => {
    const i = chatInsight([
      { role: "user", content: "a", createdAt: "2026-08-01T10:00:00Z" },
      { role: "agent", content: "b", createdAt: "2026-08-03T12:00:00Z" },
    ]);
    expect(i.firstAt).toBe("2026-08-01T10:00:00.000Z");
    expect(i.lastAt).toBe("2026-08-03T12:00:00.000Z");
  });
});

// 对话形成过程洞察(纯函数):把 ChatMessage 流水提炼成评委可读的原创性佐证摘要。
// 不做任何权限判断——调用方(judge页)已按评审分配把关。

export interface InsightMsg {
  role: string;
  content: string;
  /** 兼容原始字符串或已解析对象(chatHistory 返回已解析) */
  meta?: string | Record<string, unknown> | null;
  createdAt?: string | Date;
}

interface MsgMeta {
  updates?: { step: number; key: string; value: unknown }[];
  grill?: { q?: string; why?: string } | null;
}

export interface ChatInsight {
  /** 用户发言轮数 */
  turns: number;
  /** 通过对话记录(含覆盖)的材料字段数,去重 */
  fieldCount: number;
  fields: { step: number; key: string }[];
  /** 口述落表的测试案例数 */
  testsNarrated: number;
  /** 拷问次数 / 其中被正面作答的次数 */
  grillAsked: number;
  grillAnswered: number;
  /** 追问补预期的次数 */
  expectedFollowups: number;
  firstAt: string | null;
  lastAt: string | null;
  /** 拷问答摘录(最多3组,问+答节选) */
  highlights: { q: string; answer: string }[];
}

function parseMeta(m: InsightMsg["meta"]): MsgMeta {
  if (!m) return {};
  if (typeof m === "object") return m as MsgMeta;
  try {
    return JSON.parse(m) as MsgMeta;
  } catch {
    return {};
  }
}

export function chatInsight(msgs: InsightMsg[]): ChatInsight {
  const fields = new Map<string, { step: number; key: string }>();
  let turns = 0;
  let testsNarrated = 0;
  let grillAsked = 0;
  let grillAnswered = 0;
  let expectedFollowups = 0;
  const highlights: { q: string; answer: string }[] = [];

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const meta = parseMeta(m.meta);
    if (m.role === "user") turns++;
    if (m.role === "agent") {
      for (const u of meta.updates ?? []) {
        if (u.step === 8 && u.key === "testCase") testsNarrated++;
        else if (u.step === 8 && u.key === "testCaseExpected") expectedFollowups++;
        else if (typeof u.step === "number" && u.key && u.step >= 1 && u.step <= 6) {
          fields.set(`${u.step}.${u.key}`, { step: u.step, key: u.key });
        }
      }
      if (meta.grill?.q) {
        grillAsked++;
        const next = msgs[i + 1];
        if (next?.role === "user" && next.content.trim()) {
          grillAnswered++;
          if (highlights.length < 3) {
            highlights.push({
              q: meta.grill.q.slice(0, 80),
              answer: next.content.trim().slice(0, 90),
            });
          }
        }
      }
    }
  }

  return {
    turns,
    fieldCount: fields.size,
    fields: [...fields.values()],
    testsNarrated,
    grillAsked,
    grillAnswered,
    expectedFollowups,
    firstAt: msgs[0]?.createdAt ? new Date(msgs[0].createdAt).toISOString() : null,
    lastAt: msgs.length ? new Date(msgs[msgs.length - 1].createdAt ?? 0).toISOString() : null,
    highlights,
  };
}

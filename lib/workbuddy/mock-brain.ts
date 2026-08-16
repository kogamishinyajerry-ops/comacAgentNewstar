// WorkBuddy 离线大脑:Mock 模式下的确定性意图路由。
// 只负责"理解意图并给出工具调用计划",工具执行是真实的(确认流也真实),保证演示可复现。

export interface BuddyPlan {
  reply?: string;
  toolCalls?: { id: string; action: string; input: Record<string, unknown> }[];
}

export interface BuddyToolRun {
  action: string;
  ok: boolean;
  needsConfirmation?: boolean;
  confirmationId?: string;
  summary?: string;
  error?: string;
  result?: Record<string, unknown>;
}

const quoted = (s: string): string[] => [...s.matchAll(/[《「"]([^《」"]{2,60})[》」"]/g)].map((m) => m[1].trim());
const dateOf = (s: string): string | null => s.match(/\d{4}-\d{1,2}-\d{1,2}( \d{1,2}:\d{2})?/)?.[0] ?? null;

/** 第一轮:根据用户话术给出计划(可能带工具调用) */
export function mockPlan(message: string): BuddyPlan {
  const m = message.trim();

  if (/概览|总览|进展|情况如何|怎么样了|多少|几个|统计|看板/.test(m)) {
    return { toolCalls: [{ id: "t1", action: "activity.overview", input: {} }] };
  }
  if (/事件|刚发生|日志|动态|留痕/.test(m)) {
    return { toolCalls: [{ id: "t1", action: "events.recent", input: { limit: 10 } }] };
  }
  if (/公告/.test(m)) {
    const q = quoted(m);
    const title = q[0] ?? (m.replace(/.*(发布|发一条|写一条|发个)/, "").replace(/公告.*/, "").trim().slice(0, 40) || "新公告");
    const body = q[1] ?? m.slice(0, 200);
    return { toolCalls: [{ id: "t1", action: "announcement.publish", input: { title, body } }] };
  }
  if (/截止|延期|顺延|改期|时间改|日期/.test(m)) {
    const d = dateOf(m);
    if (!d) {
      return { reply: "好的——要改哪个时间?请直接说,例如:「提交截止改为 2026-10-12 18:00」「活动结束日期改为 2026-10-20」。" };
    }
    const field = /截止/.test(m) ? "submissionDeadline" : /结束/.test(m) ? "endDate" : "startDate";
    return { toolCalls: [{ id: "t1", action: "activity.updateConfig", input: { [field]: d } }] };
  }
  if (/改名|名称|口号|slogan|简介/.test(m)) {
    const q = quoted(m);
    if (q.length === 0) return { reply: "要改成什么?请把新名称或口号用「」括起来,例如:活动改名「青年AI轻创季」。" };
    const field = /口号|slogan/.test(m) ? "slogan" : /简介/.test(m) ? "intro" : "name";
    return { toolCalls: [{ id: "t1", action: "activity.updateConfig", input: { [field]: q[0] } }] };
  }
  if (/催办|提醒| nudg|推进一下|问问进度/.test(m)) {
    const q = quoted(m);
    const projectId = m.match(/[a-z0-9]{20,}/i)?.[0];
    if (!projectId) {
      return { reply: "催办需要指定项目。可以在组织者「项目总览」里复制项目 ID,再说「催办项目 <ID>」;也可以先让我看活动概览,报出项目名我来找。" };
    }
    return { toolCalls: [{ id: "t1", action: "notice.send", input: { mode: "project", projectId, ...(q[0] ? { message: q[0] } : {}) } }] };
  }
  if (/退回|预赛|决赛|归档/.test(m)) {
    const projectId = m.match(/[a-z0-9]{20,}/i)?.[0];
    const action = /退回/.test(m) ? "return" : /预赛/.test(m) ? "preliminary" : /决赛/.test(m) ? "final" : "archive";
    const reason = quoted(m)[0] ?? (action === "return" ? m.replace(/.*退回/, "").trim().slice(0, 200) : undefined);
    if (!projectId) return { reply: "需要项目 ID 才能变更状态(可在组织者项目总览复制),例如:「项目 <ID> 退回,原因「测试覆盖不足」」。" };
    if (action === "return" && !reason) return { reply: "退回补充必须给原因,请补一句,例如:「项目 <ID> 退回,原因「失败案例缺失败原因」」。" };
    return { toolCalls: [{ id: "t1", action: "project.setStatus", input: { projectId, action, ...(reason ? { reason } : {}) } }] };
  }
  if (/你好|hi|hello|你是谁|帮助|能做什么|help/.test(m)) {
    return {
      reply:
        "我是 WorkBuddy,本活动的总控 Agent。可以直接对我说:\n· 「看下活动概览」——全局进展与统计\n· 「最近发生了什么」——事件中心动态\n· 「发一条公告《标题》内容…」\n· 「提交截止改为 2026-10-12 18:00」\n· 「催办项目 <项目ID>」\n· 「项目 <项目ID> 退回,原因「…」」\n查询类我直接回答;敏感操作我会生成确认单,经你在右侧(或 /workbuddy)批准后才真正执行。",
    };
  }
  return {
    reply:
      "这句我还没完全理解。我可以:看活动概览、查最近事件、发公告、改活动配置(日期/名称/口号)、催办项目、变更项目状态、分配评委。试试「看下活动概览」,或输入「帮助」。",
  };
}

/** 第二轮:工具执行完毕后的确定性回复 */
export function mockReplyAfterTools(runs: BuddyToolRun[]): string {
  const parts: string[] = [];
  for (const r of runs) {
    if (r.error) {
      parts.push(`⚠️ ${r.action} 执行失败:${r.error}`);
      continue;
    }
    if (r.needsConfirmation) {
      parts.push(`🧾 已生成确认单:${r.summary}\n等待人工批准(右侧「待确认」或 /workbuddy 页面),批准后按上述参数原样执行;确认单号 ${r.confirmationId?.slice(0, 8)}…`);
      continue;
    }
    const res = r.result ?? {};
    if (r.action === "activity.overview") {
      const counts = res.projectCounts as Record<string, string | number> | undefined;
      const activity = res.activity as { name?: string; submissionDeadline?: string } | null | undefined;
      parts.push(
        `📊 ${activity?.name ?? "活动"} 快照:\n· 项目:${Object.entries(counts ?? {}).map(([k, v]) => `${k}:${v}`).join(" / ") || "无"}\n· 队伍:${res.teamCount} · 评委:${res.judgeCount} · 待确认敏感操作:${res.pendingConfirmations}\n· 提交截止:${activity?.submissionDeadline ?? "未设置"}`
      );
      continue;
    }
    if (r.action === "events.recent") {
      const events = (res.events as { seq: number; type: string; actorName?: string }[] | undefined) ?? [];
      parts.push(`🕘 最近事件:\n${events.slice(0, 6).map((e) => `#${e.seq} ${e.type}${e.actorName ? `(${e.actorName})` : ""}`).join("\n") || "(暂无)"}`);
      continue;
    }
    parts.push(`✅ ${r.action} 已执行:${JSON.stringify(res).slice(0, 160)}`);
  }
  return parts.join("\n\n");
}

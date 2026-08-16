// 事件中心:领域事件类型目录(单一事实源)
// 约定:payload 只放 id/标题/状态/计数等非敏感摘要,绝不放材料全文、密钥或用户口令,
// 以守住"组织者看不到未提交草稿全文""Key 不进日志"两条红线。

export const EVENT_TYPES = [
  // 项目生命周期
  "project.created",
  "project.submitted",
  "project.status_changed",
  // 内容与通知
  "announcement.published",
  "notice.sent",
  // 评审
  "review.assigned",
  "review.locked",
  // 配置
  "activity.config_updated",
  "track.toggled",
  // 权限确认机制(PendingAction 生命周期)
  "confirmation.requested",
  "confirmation.executed",
  "confirmation.denied",
  "confirmation.expired",
  // WorkBuddy / MCP 接入
  "agent.token_created",
  "agent.token_revoked",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export interface EventInput {
  type: EventType;
  payload?: Record<string, unknown>;
  actor?: { id?: string; name: string } | null;
  projectId?: string | null;
}

/** 落库后的事件(消费者视角) */
export interface StoredEvent {
  id: string;
  seq: number;
  type: EventType;
  payload: Record<string, unknown>;
  actorId: string | null;
  actorName: string;
  projectId: string | null;
  createdAt: string;
}

export function isEventType(v: string): v is EventType {
  return (EVENT_TYPES as readonly string[]).includes(v);
}

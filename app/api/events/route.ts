// 事件中心查询:最近领域事件(仅组织者/管理员;游标 sinceSeq 供轮询)
import { apiUser, jsonError } from "@/lib/auth";
import { listEvents } from "@/lib/events/bus";
import { isEventType } from "@/lib/events/types";

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可查看事件流");
  const url = new URL(req.url);
  const sinceSeq = Number(url.searchParams.get("sinceSeq")) || undefined;
  const limit = Math.min(Number(url.searchParams.get("limit")) || 30, 200);
  const type = url.searchParams.get("type");
  const types = type && isEventType(type) ? [type] : undefined;
  const events = await listEvents({ sinceSeq, types, limit });
  return Response.json({ ok: true, events });
}

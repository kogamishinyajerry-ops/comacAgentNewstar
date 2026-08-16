// 权限确认:待确认列表 + 历史(仅组织者/管理员;批准必须是登录的人,Agent 令牌不能批准)
import { apiUser, jsonError } from "@/lib/auth";
import { listActivityPending } from "@/lib/control";

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可查看确认队列");
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const pending = await listActivityPending(
    status === "all" ? { limit: 100 } : status ? { status: status as "PENDING", limit: 100 } : { status: "PENDING", limit: 100 }
  );
  return Response.json({ ok: true, confirmations: pending });
}

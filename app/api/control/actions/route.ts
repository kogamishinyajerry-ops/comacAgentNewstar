// Activity Control REST:当前登录角色可用的动作目录(含 inputSchema)
import { apiUser, jsonError } from "@/lib/auth";
import { activityActionsForRole } from "@/lib/control";
import { zodToJsonSchema } from "@/lib/control/zod-json";
import { ROLE_LABELS } from "@/lib/constants";

export async function GET() {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const actions = activityActionsForRole(user.role).map((d) => ({
    id: d.id,
    title: d.title,
    description: d.description,
    risk: d.risk,
    roles: d.roles,
    inputSchema: zodToJsonSchema(d.input),
  }));
  return Response.json({ ok: true, role: `${user.role}(${ROLE_LABELS[user.role]})`, actions });
}

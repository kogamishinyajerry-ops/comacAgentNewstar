// Activity Control REST:执行动作。SAFE 直接执行;SENSITIVE 返回待确认单。
import { apiUser, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { runActivityAction } from "@/lib/control";
import { ControlError } from "@/lib/control/types";

const Body = {
  parse(v: unknown) {
    if (typeof v !== "object" || v === null) return null;
    const o = v as { action?: unknown; input?: unknown };
    return typeof o.action === "string" && o.action.length > 0 ? { action: o.action, input: o.input ?? {} } : null;
  },
};

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const body = Body.parse(await readJson(req));
  if (!body) return jsonError(400, "参数错误:需要 {action, input}");
  try {
    const outcome = await runActivityAction(body.action, body.input, {
      actorId: user.id,
      actorName: user.name,
      role: user.role,
      source: "web",
    });
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof ControlError) return jsonError(e.status, e.message, { code: e.code, detail: e.detail });
    throw e;
  }
}

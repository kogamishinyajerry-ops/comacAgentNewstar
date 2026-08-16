// 权限确认:人工批准/拒绝。批准后按冻结输入原样执行。
import { z } from "zod";
import { apiUser, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { resolveActivityConfirmation } from "@/lib/control";
import { ControlError } from "@/lib/control/types";

const Body = z.object({
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().max(200).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可处理确认");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  try {
    const outcome = await resolveActivityConfirmation(params.id, { id: user.id, name: user.name, role: user.role }, parsed.data.decision, parsed.data.note);
    return Response.json({ ok: true, ...outcome });
  } catch (e) {
    if (e instanceof ControlError) return jsonError(e.status, e.message, { code: e.code });
    throw e;
  }
}

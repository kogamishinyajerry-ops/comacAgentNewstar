import { z } from "zod";
import { jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { runAgent } from "@/lib/llm/coach";
import { checkRateLimit } from "@/lib/llm/provider";

const Body = z.object({
  step: z.number().int().min(1).max(10),
  purpose: z.enum(["COACH", "PRECHECK"]).default("COACH"),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  if (!checkRateLimit(access.user.id)) {
    return jsonError(429, "Agent 调用过于频繁,请一分钟后再试");
  }

  const result = await runAgent({
    bundle: access.bundle,
    step: parsed.data.step,
    purpose: parsed.data.purpose,
  });
  return Response.json({
    ok: true,
    feedback: result.feedback,
    sessionId: result.sessionId,
    feedbackId: result.feedbackId,
    status: result.status,
    provider: result.provider,
  });
}

import { z } from "zod";
import {
  checkHubCoachRateLimit,
  fixtureActForNextScene,
  getHubCoachAct,
} from "@/lib/hub/coach-provider";
import {
  hubCoachRequestClientKey,
  isSameOriginHubCoachRequest,
} from "@/lib/hub/coach-request";

export const runtime = "nodejs";
export const maxDuration = 95;

const Body = z
  .object({
    entry: z.enum(["problem", "idea"]),
    completedAct: z.union([z.literal(0), z.literal(1)]),
    answers: z.array(z.string().trim().min(1).max(600)).min(1).max(2),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.answers.length !== value.completedAct + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers"],
        message: "answers must match completed scenes",
      });
    }
  });

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Public, no-DB next-scene endpoint. It intentionally exposes no provider
 * diagnostics: all normal upstream failures and local rate-limit exhaustion
 * continue with the deterministic fixture path.
 */
export async function POST(request: Request) {
  if (!isSameOriginHubCoachRequest(request)) {
    return Response.json({ ok: false, error: "请求来源不正确" }, { status: 403 });
  }

  const parsed = Body.safeParse(await requestBody(request));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "请求格式不正确" }, { status: 400 });
  }

  const { entry, completedAct, answers } = parsed.data;
  if (!checkHubCoachRateLimit(hubCoachRequestClientKey(request))) {
    return Response.json({
      ok: true,
      mode: "fixture",
      act: fixtureActForNextScene(entry, completedAct),
    });
  }

  const result = await getHubCoachAct({ entry, completedAct, answers });
  return Response.json({ ok: true, mode: result.mode, act: result.act });
}

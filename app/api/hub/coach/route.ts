import { z } from "zod";
import {
  COACH_ATTACHMENT_MAX_BYTES,
  COACH_REQUEST_MAX_BODY_BYTES,
  coachAttachmentSchema,
} from "@/lib/hub/coach-attachment";
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
    attachment: coachAttachmentSchema.optional(),
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

/**
 * 有上限的请求体读取。Content-Length 只是提示:缺失、伪造或 chunked 时
 * 仍以流式实读字节数为准,超限立即取消读取并返回 null(与坏 JSON 同路,
 * 统一走通用 400,不回显任何内容)。
 */
async function requestBody(request: Request): Promise<unknown> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const length = Number(declared);
    if (!Number.isInteger(length) || length < 0 || length > COACH_REQUEST_MAX_BODY_BYTES) {
      return null;
    }
  }
  const stream = request.body;
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > COACH_REQUEST_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
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

  const { entry, completedAct, answers, attachment } = parsed.data;
  // zod bounds characters, not bytes; recount the real UTF-8 payload so a
  // multi-byte attachment cannot slip past the 1MB boundary.
  if (
    attachment &&
    Buffer.byteLength(attachment.content, "utf8") > COACH_ATTACHMENT_MAX_BYTES
  ) {
    return Response.json({ ok: false, error: "请求格式不正确" }, { status: 400 });
  }
  if (!checkHubCoachRateLimit(hubCoachRequestClientKey(request))) {
    return Response.json({
      ok: true,
      mode: "fixture",
      act: fixtureActForNextScene(entry, completedAct),
    });
  }

  const result = await getHubCoachAct({
    entry,
    completedAct,
    answers,
    ...(attachment ? { attachment } : {}),
  });
  return Response.json({ ok: true, mode: result.mode, act: result.act });
}

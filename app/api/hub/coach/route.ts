import { z } from "zod";
import {
  COACH_ATTACHMENT_MAX_BYTES,
  COACH_REQUEST_MAX_BODY_BYTES,
  coachAttachmentSchema,
} from "@/lib/hub/coach-attachment";
import {
  checkHubCoachRateLimit,
  getHubCoachAct,
} from "@/lib/hub/coach-provider";
import {
  hubCoachRequestClientKey,
  isSameOriginHubCoachRequest,
} from "@/lib/hub/coach-request";

export const runtime = "nodejs";
export const maxDuration = 95;

/** 三幕请求体:已完成 0|1 幕,请求下一幕(act 3 由客户端凝结) */
const ActBody = z
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

/** 第四幕请求体:种子三槽摘录 + 已完成深化轮,请求下一深化轮(末轮同样客户端凝结) */
const ArtifactBody = z
  .object({
    entry: z.enum(["problem", "idea"]),
    seed: z
      .object({
        moment: z.string().trim().min(1).max(72),
        impact: z.string().trim().min(1).max(72),
        necessity: z.string().trim().min(1).max(72),
      })
      .strict(),
    artifactRound: z.union([z.literal(0), z.literal(1)]),
    artifactAnswers: z.array(z.string().trim().min(1).max(600)).min(1).max(2),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.artifactAnswers.length !== value.artifactRound + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactAnswers"],
        message: "artifactAnswers must match completed deepening rounds",
      });
    }
  });

const Body = z.union([ActBody, ArtifactBody]);

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

  /* 限流计数先于任何请求体读取:超限响应不读正文、不解析、不调用 Coach。
     此时服务端不知道 entry/completedAct,返回不带 act 的 fixture 信号,
     客户端以其本地确定性 fixture 继续(合同见 coach-flow 的解析);
     恶意大 body 因此无法在计数之前消耗读取与解析成本。 */
  if (!checkHubCoachRateLimit(hubCoachRequestClientKey(request))) {
    return Response.json({ ok: true, mode: "fixture" });
  }

  const parsed = Body.safeParse(await requestBody(request));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "请求格式不正确" }, { status: 400 });
  }

  const { entry } = parsed.data;
  if (!("completedAct" in parsed.data)) {
    const artifactBody = parsed.data;
    const result = await getHubCoachAct({
      entry,
      artifact: {
        round: artifactBody.artifactRound,
        seed: artifactBody.seed,
        answers: artifactBody.artifactAnswers,
      },
    });
    return Response.json({ ok: true, mode: result.mode, act: result.act });
  }

  const actBody = parsed.data;
  // zod bounds characters, not bytes; recount the real UTF-8 payload so a
  // multi-byte attachment cannot slip past the 1MB boundary.
  if (
    actBody.attachment &&
    Buffer.byteLength(actBody.attachment.content, "utf8") > COACH_ATTACHMENT_MAX_BYTES
  ) {
    return Response.json({ ok: false, error: "请求格式不正确" }, { status: 400 });
  }

  const result = await getHubCoachAct({
    entry,
    completedAct: actBody.completedAct,
    answers: actBody.answers,
    ...(actBody.attachment ? { attachment: actBody.attachment } : {}),
  });
  return Response.json({ ok: true, mode: result.mode, act: result.act });
}

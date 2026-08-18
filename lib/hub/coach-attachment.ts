/**
 * Coach 回答器附件(第一版:单一文本附件)。
 *
 * 客户端与 /api/hub/coach 服务端共享的同一份校验契约:
 * 只允许 .txt / .md / .csv / .json,最大 1MB,内容非空。
 * 附件内容永远是不可信用户资料:只随当前回答一次性发送,
 * 不持久化、不写入日志、不得被视为提示词或指令。
 */
import { z } from "zod";

export const COACH_ATTACHMENT_MAX_BYTES = 1024 * 1024;

/**
 * /api/hub/coach 请求体总量上限(字节)。合法上界:1MB 附件文本经 JSON 最坏
 * 转义(控制字符 → \u00XX,每字节 6 个 ASCII 字符)约 6 倍体积,再加回答、
 * 字段与包装开销。超过上限的请求在解析前直接拒绝,不进入日志、响应或 provider。
 */
export const COACH_REQUEST_MAX_BODY_BYTES = COACH_ATTACHMENT_MAX_BYTES * 6 + 256 * 1024;

export const COACH_ATTACHMENT_EXTENSIONS = [".txt", ".md", ".csv", ".json"] as const;

/** 原生 file input 的 accept 提示;真实校验永远在 validateCoachAttachment / schema */
export const COACH_ATTACHMENT_ACCEPT = COACH_ATTACHMENT_EXTENSIONS.join(",");

export interface CoachAttachment {
  /** 浏览器 File.name;仅用于本轮 Chip 展示与提示,不代表可信路径 */
  name: string;
  /** 浏览器 File.size(字节) */
  size: number;
  /** 已按文本完整读出的内容 */
  content: string;
}

export function hasCoachAttachmentExtension(name: string): boolean {
  const lower = name.trim().toLowerCase();
  return COACH_ATTACHMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 返回 null 表示合法;否则返回可直接行内展示的错误文案(不指责) */
export function validateCoachAttachment(
  attachment: Pick<CoachAttachment, "name" | "size" | "content">
): string | null {
  if (!hasCoachAttachmentExtension(attachment.name)) {
    return "暂不支持该文件类型，仅支持 .txt / .md / .csv / .json 文本附件。";
  }
  if (attachment.size <= 0 || attachment.content.trim().length === 0) {
    return "附件内容为空，没有可发送的文本。";
  }
  if (attachment.size > COACH_ATTACHMENT_MAX_BYTES) {
    return "附件超过 1MB，请删减内容后再试。";
  }
  return null;
}

/** Chip 上的紧凑大小显示 */
export function formatCoachAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 服务端边界校验(zod)。size 以字节计、content 以字符计:客户端按 File.size
 * 预检字节数;服务端复核声明大小,并在路由层以 UTF-8 字节长度复算内容
 * (多字节字符的字符数 ≤ 字节数,单靠字符上限不能拦截超限字节内容)。
 */
export const coachAttachmentSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    size: z.number().int().min(1).max(COACH_ATTACHMENT_MAX_BYTES),
    content: z.string().min(1).max(COACH_ATTACHMENT_MAX_BYTES),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!hasCoachAttachmentExtension(value.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["name"],
        message: "unsupported attachment type",
      });
    }
    if (value.content.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "attachment content is empty",
      });
    }
  });

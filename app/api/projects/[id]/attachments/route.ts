import { z } from "zod";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { audit, jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";

const LinkBody = z.object({
  kind: z.literal("LINK"),
  title: z.string().trim().min(1, "请填写标题").max(80),
  url: z.string().trim().url("链接格式不正确").max(500),
});

const MAX_MB = Number(process.env.UPLOAD_MAX_MB) > 0 ? Number(process.env.UPLOAD_MAX_MB) : 10;
const UPLOAD_DIR = process.env.UPLOAD_DIR || "data/uploads";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = LinkBody.safeParse(await readJson(req));
    if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
    const row = await prisma.attachment.create({
      data: { projectId: params.id, kind: "LINK", title: parsed.data.title, url: parsed.data.url },
    });
    await audit(access.user, "attachment.link.add", "Attachment", row.id, parsed.data.title);
    return Response.json({ ok: true, attachment: { id: row.id, kind: row.kind, title: row.title, url: row.url, sizeKb: row.sizeKb } });
  }

  // 文件上传(multipart)
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const title = String(form?.get("title") ?? "");
  if (!(file instanceof File)) return jsonError(400, "缺少文件");
  if (file.size > MAX_MB * 1024 * 1024) {
    return jsonError(413, `文件超过上限${MAX_MB}MB`);
  }
  const safeExt = (path.extname(file.name) || "").replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
  const stored = `${randomUUID()}${safeExt}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, stored), Buffer.from(await file.arrayBuffer()));
  const row = await prisma.attachment.create({
    data: {
      projectId: params.id,
      kind: "FILE",
      title: title.trim() || file.name.slice(0, 80),
      url: stored,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
    },
  });
  await audit(access.user, "attachment.file.add", "Attachment", row.id, `${row.title} ${row.sizeKb}KB`);
  return Response.json({ ok: true, attachment: { id: row.id, kind: row.kind, title: row.title, url: `/api/attachments/${row.id}/download`, sizeKb: row.sizeKb } });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const attId = new URL(req.url).searchParams.get("attId");
  if (!attId) return jsonError(400, "缺少attId");
  const row = await prisma.attachment.findUnique({ where: { id: attId } });
  if (!row || row.projectId !== params.id) return jsonError(404, "附件不存在");
  await prisma.attachment.delete({ where: { id: attId } });
  if (row.kind === "FILE") {
    await unlink(path.join(UPLOAD_DIR, row.url)).catch(() => undefined);
  }
  await audit(access.user, "attachment.delete", "Attachment", attId, row.title);
  return Response.json({ ok: true });
}

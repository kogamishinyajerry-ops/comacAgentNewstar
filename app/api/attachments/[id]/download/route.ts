import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/auth";
import { projectAccess } from "@/lib/api-helpers";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "data/uploads";

const MIME: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".json": "application/json", ".zip": "application/zip",
  ".mp4": "video/mp4", ".mov": "video/quicktime",
};

/** 附件下载:复用项目查看权限,文件名不暴露存储路径 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = await prisma.attachment.findUnique({ where: { id: params.id } });
  if (!row || row.kind !== "FILE") return jsonError(404, "附件不存在");
  const access = await projectAccess(row.projectId, "view");
  if (!access.ok) return access.error;

  const ext = path.extname(row.url).toLowerCase();
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, row.url));
    const safeName = row.title.replace(/[^\w\u4e00-\u9fa5.-]/g, "_");
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(safeName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return jsonError(404, "文件已不存在");
  }
}

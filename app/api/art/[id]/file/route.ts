import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/auth";

const ART_DIR = process.env.ART_DIR || "data/art";

const MIME: Record<string, string> = {
  ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
};

/** 插画文件:项目插画走权限校验;全局每日灵感(projectId为空)公开可看 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const row = await prisma.artAsset.findUnique({ where: { id: params.id } });
  if (!row) return jsonError(404, "插画不存在");
  if (row.projectId) {
    const { projectAccess } = await import("@/lib/api-helpers");
    const access = await projectAccess(row.projectId, "view");
    if (!access.ok) return access.error;
  }
  try {
    const buf = await readFile(path.join(ART_DIR, path.basename(row.file)));
    const ext = path.extname(row.file).toLowerCase();
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError(404, "插画文件已不存在");
  }
}

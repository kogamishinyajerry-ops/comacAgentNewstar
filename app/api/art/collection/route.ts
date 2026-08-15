import { prisma } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/auth";
import { projectAccess } from "@/lib/api-helpers";
import { PROJECT_ART_SCENES } from "@/lib/art-scenes";

/** 项目插画图鉴:已收集的场景 + 全部可收集场景 */
export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const projectId = new URL(req.url).searchParams.get("projectId");
  if (!projectId) return jsonError(400, "缺少projectId");
  const access = await projectAccess(projectId, "view");
  if (!access.ok) return access.error;

  const rows = await prisma.artAsset.findMany({
    where: { projectId, scene: { in: PROJECT_ART_SCENES.map((s) => s.scene) } },
    orderBy: { createdAt: "desc" },
  });
  // 每个场景取最新一张
  const byScene = new Map<string, { id: string; url: string; provider: string; createdAt: string }>();
  for (const r of rows) {
    if (!byScene.has(r.scene)) {
      byScene.set(r.scene, { id: r.id, url: `/api/art/${r.id}/file`, provider: r.provider, createdAt: r.createdAt.toISOString() });
    }
  }
  return Response.json({
    ok: true,
    collected: [...byScene.entries()].map(([scene, a]) => ({ scene, ...a })),
    total: PROJECT_ART_SCENES.length,
  });
}

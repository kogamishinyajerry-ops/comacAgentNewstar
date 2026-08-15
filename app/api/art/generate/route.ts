import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson, projectAccess } from "@/lib/api-helpers";
import { buildArtPrompt, generateAndStore } from "@/lib/minimax";

const Body = z.object({
  projectId: z.string().min(1),
  scene: z.string().trim().min(1).max(60),
  title: z.string().trim().max(60).optional(),
  track: z.string().trim().max(40).nullable().optional(),
  hint: z.string().trim().max(40).optional(),
});

const CACHE_HOURS = 12;

/** 里程碑插画生成:同项目同场景12小时内复用(控成本);无Key走离线SVG艺术 */
export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const b = parsed.data;

  const access = await projectAccess(b.projectId, "edit");
  if (!access.ok) return access.error;

  const cached = await prisma.artAsset.findFirst({
    where: { projectId: b.projectId, scene: b.scene, createdAt: { gt: new Date(Date.now() - CACHE_HOURS * 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (cached) {
    return Response.json({ ok: true, id: cached.id, url: `/api/art/${cached.id}/file`, cached: true, provider: cached.provider });
  }

  const prompt = buildArtPrompt({ scene: b.scene, title: b.title, track: b.track, hint: b.hint });
  try {
    const { file, provider } = await generateAndStore(prompt);
    const row = await prisma.artAsset.create({
      data: { projectId: b.projectId, scene: b.scene, prompt, file, provider },
    });
    await audit(user, "art.generate", "ArtAsset", row.id, `${b.scene}(${provider})`);
    return Response.json({ ok: true, id: row.id, url: `/api/art/${row.id}/file`, cached: false, provider });
  } catch (e) {
    return jsonError(502, `插画生成失败:${e instanceof Error ? e.message.slice(0, 120) : "未知错误"}`);
  }
}

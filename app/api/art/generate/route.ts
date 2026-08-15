import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson, projectAccess } from "@/lib/api-helpers";
import { buildArtPrompt, generateAndStore } from "@/lib/minimax";
import { isDailyScene } from "@/lib/art-scenes";

const Body = z.object({
  projectId: z.string().optional(),
  scene: z.string().trim().min(1).max(60),
  title: z.string().trim().max(60).optional(),
  track: z.string().trim().max(40).nullable().optional(),
  hint: z.string().trim().max(40).optional(),
});

const CACHE_HOURS = 12;

/** 插画生成:项目场景需成员权限;每日灵感(daily-*)全局公开、按日缓存(控成本) */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const b = parsed.data;

  // 全局每日灵感:无项目、无登录也可生成(同日全站共用一份)
  if (isDailyScene(b.scene)) {
    const cached = await prisma.artAsset.findFirst({
      where: { projectId: null, scene: b.scene },
      orderBy: { createdAt: "desc" },
    });
    if (cached) {
      return Response.json({ ok: true, id: cached.id, url: `/api/art/${cached.id}/file`, cached: true, provider: cached.provider });
    }
    const prompt = buildArtPrompt({ scene: "daily", hint: "每日灵感" });
    try {
      const { file, provider } = await generateAndStore(prompt);
      const row = await prisma.artAsset.create({ data: { projectId: null, scene: b.scene, prompt, file, provider } });
      return Response.json({ ok: true, id: row.id, url: `/api/art/${row.id}/file`, cached: false, provider });
    } catch (e) {
      return jsonError(502, `插画生成失败:${e instanceof Error ? e.message.slice(0, 120) : "未知错误"}`);
    }
  }

  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (!b.projectId) return jsonError(400, "缺少projectId");

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

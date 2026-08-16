import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";
import { emitEvent } from "@/lib/events/bus";

const ContentBody = z.object({
  kind: z.enum(["announcement", "inspiration", "officeHour"]),
  // announcement
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().max(2000).optional(),
  pinned: z.boolean().optional(),
  // inspiration
  track: z.string().trim().max(40).optional(),
  summary: z.string().trim().max(500).optional(),
  tags: z.string().trim().max(80).optional(),
  // office hour
  host: z.string().trim().max(60).optional(),
  time: z.string().trim().max(60).optional(),
  place: z.string().trim().max(120).optional(),
  capacity: z.number().int().min(1).max(200).optional(),
});

export async function POST(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");
  const parsed = ContentBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");
  const b = parsed.data;

  if (b.kind === "announcement") {
    if (!b.title?.trim() || !b.body?.trim()) return jsonError(400, "公告需要标题与正文");
    const row = await prisma.announcement.create({ data: { title: b.title, body: b.body, pinned: b.pinned ?? false } });
    await audit(user, "content.announcement.create", "Announcement", row.id, b.title);
    await emitEvent({ type: "announcement.published", payload: { announcementId: row.id, title: row.title, pinned: row.pinned }, actor: user });
    return Response.json({ ok: true, id: row.id });
  }
  if (b.kind === "inspiration") {
    if (!b.title?.trim() || !b.summary?.trim()) return jsonError(400, "灵感案例需要标题与摘要");
    const row = await prisma.inspirationCase.create({ data: { title: b.title, summary: b.summary, track: b.track ?? null, tags: b.tags ?? "" } });
    await audit(user, "content.inspiration.create", "InspirationCase", row.id, b.title);
    return Response.json({ ok: true, id: row.id });
  }
  if (!b.title?.trim() || !b.host?.trim() || !b.time?.trim() || !b.place?.trim()) {
    return jsonError(400, "Office Hour 需要主题、主持人、时间与地点");
  }
  const row = await prisma.officeHour.create({
    data: { title: b.title, host: b.host, time: b.time, place: b.place, capacity: b.capacity ?? 20 },
  });
  await audit(user, "content.officehour.create", "OfficeHour", row.id, b.title);
  return Response.json({ ok: true, id: row.id });
}

export async function DELETE(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可操作");
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  if (!kind || !id) return jsonError(400, "缺少参数");
  if (kind === "announcement") await prisma.announcement.delete({ where: { id } });
  else if (kind === "inspiration") await prisma.inspirationCase.delete({ where: { id } });
  else if (kind === "officeHour") await prisma.officeHour.delete({ where: { id } });
  else return jsonError(400, "类型无效");
  await audit(user, `content.${kind}.delete`, kind, id);
  return Response.json({ ok: true });
}

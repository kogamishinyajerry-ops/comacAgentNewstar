import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";
import { readJson } from "@/lib/api-helpers";

const ActivityBody = z.object({
  name: z.string().trim().min(1).max(60),
  slogan: z.string().trim().min(1).max(100),
  intro: z.string().trim().max(500),
  startDate: z.string().trim().max(20).optional(),
  endDate: z.string().trim().max(20).optional(),
  submissionDeadline: z.string().trim().max(30).optional(),
});

async function requireOrganizer() {
  const user = await apiUser();
  if (!user) return { error: jsonError(401, "请先登录") };
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return { error: jsonError(403, "仅组织者可操作") };
  return { user };
}

export async function PUT(req: Request) {
  const { user, error } = await requireOrganizer();
  if (error) return error;
  const parsed = ActivityBody.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const config = await prisma.activityConfig.upsert({
    where: { id: "main" },
    update: parsed.data,
    create: { id: "main", ...parsed.data },
  });
  await audit(user, "config.activity.update", "ActivityConfig", "main");
  return Response.json({ ok: true, config });
}

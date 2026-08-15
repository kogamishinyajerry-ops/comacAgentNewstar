import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { jsonError } from "@/lib/auth";
import { TRACK_KEYS } from "@/lib/constants";

const Body = z.object({
  title: z.string().trim().min(2).max(60).optional(),
  track: z.string().refine((t) => TRACK_KEYS.includes(t), "赛道无效").nullable().optional(),
  currentStep: z.number().int().min(1).max(10).optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const project = await prisma.ideaProject.update({
    where: { id: params.id },
    data: parsed.data,
  });
  if (parsed.data.track !== undefined) {
    await audit(access.user, "project.track", "IdeaProject", project.id, parsed.data.track ?? "清除");
  }
  return Response.json({ ok: true, project: { id: project.id, track: project.track, currentStep: project.currentStep } });
}

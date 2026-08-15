import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { validateStageData } from "@/lib/validation";
import { getStageData } from "@/lib/validation";

const Body = z.object({
  data: z.record(z.unknown()),
  /** 点"下一步"时带 strict,阻止必填未完成时前进 */
  strict: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string; step: string } }) {
  const step = Number(params.step);
  if (!Number.isInteger(step) || step < 1 || step > 10) return jsonError(400, "步骤无效");
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;

  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "数据格式错误");

  const merged = { ...getStageData(access.bundle.stages, step), ...parsed.data.data };
  const errors = validateStageData(step, merged);
  if (parsed.data.strict && errors.length > 0) {
    return Response.json({ ok: false, errors }, { status: 422 });
  }

  await prisma.stageResponse.upsert({
    where: { projectId_step: { projectId: params.id, step } },
    update: { data: JSON.stringify(merged) },
    create: { projectId: params.id, step, data: JSON.stringify(merged) },
  });
  if (step > access.bundle.project.currentStep) {
    await prisma.ideaProject.update({ where: { id: params.id }, data: { currentStep: step } });
  }
  return Response.json({ ok: true, savedAt: new Date().toISOString(), errors });
}

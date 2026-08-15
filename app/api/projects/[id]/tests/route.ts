import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { validateTestCases } from "@/lib/validation";

const Case = z.object({
  name: z.string().max(80).default(""),
  type: z.enum(["NORMAL", "BOUNDARY", "FAILURE", "NA"]),
  input: z.string().max(2000).default(""),
  expected: z.string().max(2000).default(""),
  actual: z.string().max(2000).default(""),
  verdict: z.enum(["PENDING", "PASS", "FAIL", "NA"]).default("PENDING"),
  manualFix: z.string().max(1000).default(""),
  failureReason: z.string().max(1000).default(""),
});

const Body = z.object({
  cases: z.array(Case).max(30),
  /** 第8步完成尝试前进时 strict:覆盖不完整则阻止 */
  strict: z.boolean().optional(),
});

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const { cases, strict } = parsed.data;
  const result = validateTestCases(cases);
  if (strict && result.errors.length > 0) {
    return Response.json({ ok: false, errors: result.errors }, { status: 422 });
  }

  await prisma.$transaction([
    prisma.testCase.deleteMany({ where: { projectId: params.id } }),
    ...cases.map((c, i) =>
      prisma.testCase.create({
        data: { projectId: params.id, sortOrder: i, name: c.name, type: c.type, input: c.input, expected: c.expected, actual: c.actual, verdict: c.verdict, manualFix: c.manualFix, failureReason: c.failureReason },
      })
    ),
  ]);
  return Response.json({ ok: true, savedAt: new Date().toISOString(), errors: result.errors });
}

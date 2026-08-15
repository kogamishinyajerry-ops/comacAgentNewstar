import { z } from "zod";
import { apiUser, jsonError } from "@/lib/auth";
import { projectAccess, readJson } from "@/lib/api-helpers";
import { chatHistory, runChatTurn } from "@/lib/llm/chat";

const Body = z.object({
  message: z.string().trim().min(1, "说点什么吧").max(4000),
});

/** 对话历史 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const access = await projectAccess(params.id, "view");
  if (!access.ok) return access.error;
  return Response.json({ ok: true, messages: await chatHistory(params.id) });
}

/** 一句话 → 结构化材料 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? "参数错误");

  const access = await projectAccess(params.id, "edit");
  if (!access.ok) return access.error;

  const result = await runChatTurn({ projectId: params.id, message: parsed.data.message, userId: user.id });
  if (!result.ok) return jsonError(result.status, result.error);
  return Response.json(result);
}

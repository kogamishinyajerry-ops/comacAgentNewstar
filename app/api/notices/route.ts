import { prisma } from "@/lib/db";
import { apiUser, jsonError } from "@/lib/auth";

/** 我的站内通知(默认只取未读+最近20条) */
export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  const all = new URL(req.url).searchParams.get("all") === "true";
  const rows = await prisma.notice.findMany({
    where: { userId: user.id, ...(all ? {} : { readAt: null }) },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return Response.json({
    ok: true,
    notices: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState } from "@/components/ui";

export default async function JudgePage() {
  const user = await requireRole("JUDGE", "ADMIN");
  const assignments = await prisma.reviewAssignment.findMany({
    where: { judgeId: user.id },
    include: {
      project: { select: { id: true, title: true, status: true } },
      review: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">评委工作台</h1>
      {assignments.length === 0 ? (
        <EmptyState title="暂无分配" desc="组织者分配作品后会出现在这里。" />
      ) : (
        <Card title={`我的评审(${assignments.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3">作品</th>
                  <th className="py-2 pr-3">轮次</th>
                  <th className="py-2 pr-3">评分状态</th>
                  <th className="py-2 pr-3">总分</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const r = a.review;
                  const total = r ? r.problemDefinition + r.originality + r.closedLoop + r.evidence : null;
                  return (
                    <tr key={a.id} className="border-b border-slate-50">
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {a.status === "RECUSED" ? (
                          a.project.title
                        ) : (
                          <Link href={`/judge/projects/${a.project.id}`} className="hover:text-brand-600">
                            {a.project.title}
                          </Link>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{a.round === "PRELIMINARY" ? "预赛" : "决赛"}</td>
                      <td className="py-2.5 pr-3">
                        {a.status === "RECUSED" ? (
                          <Badge tone="amber">已回避</Badge>
                        ) : r?.status === "LOCKED" ? (
                          <Badge tone="green">已锁定</Badge>
                        ) : r ? (
                          <Badge tone="blue">草稿</Badge>
                        ) : (
                          <Badge tone="gray">未开始</Badge>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">{total != null ? `${total}/40` : "—"}</td>
                      <td className="py-2.5 text-right">
                        {a.status !== "RECUSED" && r?.status !== "LOCKED" && (
                          <Link href={`/judge/projects/${a.project.id}`} className="text-xs text-brand-600 hover:underline">
                            {r ? "继续评审 →" : "开始评审 →"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            四维各0—10分:真问题与需求定义、原创过程与独立完成、跑通闭环与人机边界、验证证据与复盘。锁定后不可修改。
          </p>
        </Card>
      )}
    </div>
  );
}

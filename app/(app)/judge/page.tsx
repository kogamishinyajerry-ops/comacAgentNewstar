import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";

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
    <div className="space-y-4 py-2">
      <PageHeader
        title="评委工作台"
        desc="四维各0—10分:真问题与需求定义、原创过程与独立完成、跑通闭环与人机边界、验证证据与复盘。锁定后不可修改。"
      />
      {assignments.length === 0 ? (
        <EmptyState title="暂无分配" desc="组织者分配作品后会出现在这里。" />
      ) : (
        <Card title={`我的评审 · ${assignments.length}`} bodyClassName="px-4 py-1">
          <Table>
            <thead>
              <tr>
                <Th>作品</Th>
                <Th>轮次</Th>
                <Th>评分状态</Th>
                <Th>总分</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const r = a.review;
                const total = r ? r.problemDefinition + r.originality + r.closedLoop + r.evidence : null;
                return (
                  <tr key={a.id} className="transition-colors hover:bg-slate-50/70">
                    <Td className="font-medium text-slate-800">
                      {a.status === "RECUSED" ? (
                        a.project.title
                      ) : (
                        <Link href={`/judge/projects/${a.project.id}`} className="hover:text-brand-600">
                          {a.project.title}
                        </Link>
                      )}
                    </Td>
                    <Td className="text-xs">{a.round === "PRELIMINARY" ? "预赛" : "决赛"}</Td>
                    <Td>
                      {a.status === "RECUSED" ? (
                        <Badge tone="amber">已回避</Badge>
                      ) : r?.status === "LOCKED" ? (
                        <Badge tone="green">已锁定</Badge>
                      ) : r ? (
                        <Badge tone="blue">草稿</Badge>
                      ) : (
                        <Badge tone="slate">未开始</Badge>
                      )}
                    </Td>
                    <Td className="tnum">{total != null ? `${total}/40` : "—"}</Td>
                    <Td className="text-right">
                      {a.status !== "RECUSED" && r?.status !== "LOCKED" && (
                        <Link href={`/judge/projects/${a.project.id}`} className="text-xs font-medium text-brand-600 hover:underline">
                          {r ? "继续评审 →" : "开始评审 →"}
                        </Link>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

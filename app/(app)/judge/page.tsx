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
        desc="先独立理解作品的主张、证据与缺口，再完成人的判断。AI 不替你预评分，也不在初判前制造锚定。"
      />

      <div className="rounded-lg border border-blue-200/80 bg-blue-50/60 px-4 py-3 text-[13px] leading-5 text-blue-900">
        <span className="font-semibold">评审顺序：</span>
        先阅读作品与证据，形成独立判断；需要时再查看辅助信息。评分一旦锁定便不可修改。
      </div>

      {assignments.length === 0 ? (
        <EmptyState title="暂无分配" desc="组织者分配作品后会出现在这里。" />
      ) : (
        <Card title={`我的评审 · ${assignments.length}`} bodyClassName="px-4 py-1">
          <Table>
            <thead>
              <tr>
                <Th>作品</Th>
                <Th>轮次</Th>
                <Th>人的判断</Th>
                <Th>已记录分值</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => {
                const review = assignment.review;
                const total = review
                  ? review.problemDefinition +
                    review.originality +
                    review.closedLoop +
                    review.evidence
                  : null;
                return (
                  <tr key={assignment.id} className="transition-colors hover:bg-slate-50/70">
                    <Td className="font-medium text-slate-800">
                      {assignment.status === "RECUSED" ? (
                        assignment.project.title
                      ) : (
                        <Link
                          href={`/judge/projects/${assignment.project.id}`}
                          className="hover:text-brand-600"
                        >
                          {assignment.project.title}
                        </Link>
                      )}
                    </Td>
                    <Td className="text-xs">
                      {assignment.round === "PRELIMINARY" ? "预赛" : "决赛"}
                    </Td>
                    <Td>
                      {assignment.status === "RECUSED" ? (
                        <Badge tone="amber">已回避</Badge>
                      ) : review?.status === "LOCKED" ? (
                        <Badge tone="green">已锁定</Badge>
                      ) : review ? (
                        <Badge tone="blue">独立判断草稿</Badge>
                      ) : (
                        <Badge tone="slate">未开始</Badge>
                      )}
                    </Td>
                    <Td className="tnum">{total != null ? total : "—"}</Td>
                    <Td className="text-right">
                      {assignment.status !== "RECUSED" && review?.status !== "LOCKED" && (
                        <Link
                          href={`/judge/projects/${assignment.project.id}`}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          {review ? "继续独立评审 →" : "开始独立评审 →"}
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

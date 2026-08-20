import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card, EmptyState, Table, Td, Th } from "@/components/ui";
import { Reveal } from "@/components/fx";

type JudgeAssignment = {
  id: string;
  status: string;
  round: string;
  project: { id: string; title: string };
  review: { status: string } | null;
};

function ReviewStateBadge({ assignment }: { assignment: JudgeAssignment }) {
  if (assignment.status === "RECUSED") return <Badge tone="amber">已回避</Badge>;
  if (assignment.review?.status === "LOCKED") return <Badge tone="green">已锁定</Badge>;
  if (assignment.review) return <Badge tone="blue">独立判断草稿</Badge>;
  return <Badge tone="slate">未开始</Badge>;
}

function isActionable(assignment: JudgeAssignment) {
  return assignment.status !== "RECUSED" && assignment.review?.status !== "LOCKED";
}

function ReviewCta({ assignment }: { assignment: JudgeAssignment }) {
  return (
    <Link
      href={`/judge/projects/${assignment.project.id}`}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-700 hover:underline"
    >
      {assignment.review ? "继续独立评审" : "开始独立评审"}
      <span
        aria-hidden
        className="inline-block transition-transform duration-150 ease-soft group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

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

  // 空间叙事:未开始 → 进行中 → 已完成(已锁定);回避单列,数据全部来自真实分配
  const pending = assignments.filter((a) => a.status !== "RECUSED" && !a.review).length;
  const drafting = assignments.filter(
    (a) => a.status !== "RECUSED" && a.review && a.review.status !== "LOCKED"
  ).length;
  const locked = assignments.filter((a) => a.review?.status === "LOCKED").length;
  const recused = assignments.filter((a) => a.status === "RECUSED").length;

  return (
    <div className="space-y-6 py-4">
      <Reveal>
        <header>
          <p className="kicker">Judge Workspace · 人的判断</p>
          <h1 className="font-display text-display-lg mt-2 text-ink-900">评委工作台</h1>
          <p className="text-lead mt-3 max-w-2xl text-ink-500">
            先独立理解作品的主张、证据与缺口,再完成人的判断。AI 不替你预评分,也不在初判前制造锚定。
          </p>
        </header>
      </Reveal>

      {/* 状态条:一眼看清「待开始 → 进行中 → 已完成」 */}
      {assignments.length > 0 && (
        <Reveal delayMs={80}>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ink-900/10 bg-ink-900/10 sm:grid-cols-4">
            {[
              [`${pending}`, "待开始"],
              [`${drafting}`, "独立判断草稿"],
              [`${locked}`, "已锁定"],
              [`${recused}`, "已回避"],
            ].map(([n, label]) => (
              <div key={label} className="flex items-baseline gap-2 bg-[#fffdf8] px-4 py-3.5">
                <span className="font-display tnum text-2xl font-bold text-ink-900">{n}</span>
                <span className="text-xs text-ink-500">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      )}

      <Reveal delayMs={160}>
        {/* 评审顺序:克制的编辑风提示,不用色块抢焦点 */}
        <div className="flex items-start gap-3 rounded-md border border-ink-900/10 bg-[#fffdf8] px-4 py-3 shadow-card-app">
          <span aria-hidden className="mt-[7px] h-3.5 w-[3px] shrink-0 rounded-full bg-brand-500" />
          <p className="text-caption text-ink-600">
            <span className="font-semibold text-ink-800">评审顺序:</span>
            先阅读作品与证据,形成独立判断;需要时再查看辅助信息。评分一旦锁定便不可修改。
          </p>
        </div>

        <div className="mt-4">
          {assignments.length === 0 ? (
            <EmptyState title="暂无分配" desc="组织者分配作品后会出现在这里。" />
          ) : (
            <Card title={`我的评审 · ${assignments.length}`} bodyClassName="px-4 py-1">
              {/* ≥sm:完整表格;<sm:竖排卡片,主 CTA 不被横向滚出视口 */}
              <div className="hidden sm:block">
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
                        <tr
                          key={assignment.id}
                          className="group transition-colors duration-150 ease-soft hover:bg-brand-50/40"
                        >
                          <Td className="text-[13px] font-medium text-ink-800">
                            {assignment.status === "RECUSED" ? (
                              assignment.project.title
                            ) : (
                              <Link
                                href={`/judge/projects/${assignment.project.id}`}
                                className="underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-600 hover:underline hover:decoration-brand-300"
                              >
                                {assignment.project.title}
                              </Link>
                            )}
                          </Td>
                          <Td className="text-xs text-ink-500">
                            {assignment.round === "PRELIMINARY" ? "预赛" : "决赛"}
                          </Td>
                          <Td>
                            <ReviewStateBadge assignment={assignment} />
                          </Td>
                          <Td>
                            <span className="font-display tnum text-[15px] font-bold text-ink-900">
                              {total != null ? total : "—"}
                            </span>
                            {total != null && (
                              <span className="tnum text-xs text-ink-400">/40</span>
                            )}
                          </Td>
                          <Td className="text-right">
                            {isActionable(assignment) && <ReviewCta assignment={assignment} />}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>

              <ul className="space-y-2.5 py-2 sm:hidden">
                {assignments.map((assignment) => {
                  const review = assignment.review;
                  const total = review
                    ? review.problemDefinition +
                      review.originality +
                      review.closedLoop +
                      review.evidence
                    : null;
                  return (
                    <li
                      key={assignment.id}
                      className="group rounded-md border border-ink-900/10 bg-[#fffdf8] px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {assignment.status === "RECUSED" ? (
                            <p className="text-[13px] font-medium text-ink-800">{assignment.project.title}</p>
                          ) : (
                            <Link
                              href={`/judge/projects/${assignment.project.id}`}
                              className="text-[13px] font-medium text-ink-800 underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-600 hover:underline hover:decoration-brand-300"
                            >
                              {assignment.project.title}
                            </Link>
                          )}
                          <p className="mt-0.5 text-xs text-ink-500">
                            {assignment.round === "PRELIMINARY" ? "预赛" : "决赛"}
                            {" · "}已记录分值{" "}
                            <span className="tnum font-semibold text-ink-700">
                              {total != null ? `${total}/40` : "—"}
                            </span>
                          </p>
                        </div>
                        <ReviewStateBadge assignment={assignment} />
                      </div>
                      {isActionable(assignment) && (
                        <div className="mt-2 border-t border-ink-900/5 pt-2">
                          <ReviewCta assignment={assignment} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </Reveal>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { Flame } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { ReviewForm } from "./review-form";
import { RecuseButton } from "./recuse-button";
import { chatHistory } from "@/lib/llm/chat";
import { chatInsight } from "@/lib/chat-insight";

export default async function JudgeProjectPage({ params }: { params: { id: string } }) {
  const user = await requireRole("JUDGE", "ADMIN");

  const assignment = await prisma.reviewAssignment.findFirst({
    where: { projectId: params.id, judgeId: user.id },
    include: {
      review: true,
      project: { include: { team: { include: { members: { include: { user: true } } } }, snapshots: { orderBy: { version: "desc" } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!assignment) notFound();
  if (assignment.status === "RECUSED") notFound();

  const snapshot = assignment.project.snapshots[0];
  if (!snapshot) notFound();
  const payload = JSON.parse(snapshot.payload);
  const card = payload.experimentCard as {
    header: { title: string; track: string; team: string; members: string };
    sections: { heading: string; rows: { label: string; value: string }[] }[];
  };
  const locked = assignment.review?.status === "LOCKED";

  // 对话形成过程:材料在聊天中逐步长出来的留痕,佐证原创维度(提交后对话冻结,与快照时点一致)
  const messages = await chatHistory(params.id);
  const insight = chatInsight(messages);

  return (
    <div className="space-y-6 py-4">
      <Reveal>
        <header>
          <Link
            href="/judge"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-500 underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-600 hover:underline"
          >
            <span aria-hidden>←</span> 返回工作台
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="kicker">评审 · {assignment.round === "PRELIMINARY" ? "预赛" : "决赛"}</p>
            {locked && <Badge tone="green">评分已锁定</Badge>}
          </div>
          <h1 className="font-display text-display-lg mt-2 max-w-3xl text-ink-900">
            {assignment.project.title}
          </h1>
          <p className="text-caption mt-2 text-ink-500">
            {card.header.track} · {card.header.team} · {card.header.members}
          </p>
        </header>
      </Reveal>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Reveal delayMs={80}>
          <Card
            title={
              <span className="flex items-baseline gap-2">
                提交快照
                <span className="tnum text-[11px] font-normal tracking-normal text-ink-400">
                  v{snapshot.version} · {new Date(snapshot.createdAt).toLocaleString("zh-CN")}
                </span>
              </span>
            }
          >
            <p className="text-caption mb-4 text-ink-500">
              评审基于不可变提交快照——先读主张,再核对证据,最后看缺口。
            </p>
            <div className="max-h-[70vh] space-y-6 overflow-auto pr-2">
              {card.sections.map((sec, si) => (
                <section key={sec.heading}>
                  <h2 className="mb-2.5 flex items-baseline gap-2.5">
                    <span aria-hidden className="tnum text-micro font-bold text-brand-500">
                      {String(si + 1).padStart(2, "0")}
                    </span>
                    <span className="font-display text-[15px] font-bold tracking-wide text-ink-900">
                      {sec.heading}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-ink-900/10" />
                  </h2>
                  <dl className="space-y-2">
                    {sec.rows.map((r, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-[110px_1fr] gap-3 sm:grid-cols-[128px_1fr]"
                      >
                        <dt className="text-caption shrink-0 text-ink-400">{r.label}</dt>
                        <dd className="whitespace-pre-wrap break-words text-[13px] leading-6 text-ink-800">
                          {r.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <p className="mt-4 border-t border-ink-900/10 pt-3.5">
              <a
                href={`/projects/${params.id}/card?version=${snapshot.version}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-[13px] font-medium text-brand-600 underline-offset-4 transition-colors duration-150 ease-soft hover:text-brand-700 hover:underline"
              >
                打开完整小实验卡与90秒Demo脚本 <span aria-hidden>→</span>
              </a>
            </p>
          </Card>
        </Reveal>

        <div className="space-y-4">
          {(insight.turns > 0 || insight.testsNarrated > 0) && (
            <Reveal delayMs={160}>
              <Card title="对话形成过程 · 原创性佐证">
                <p className="text-caption mb-3 text-ink-500">
                  材料是否在对话中逐步形成、拷问是否被正面回答——供「原创过程与独立完成」维度参考,非评分依据本身。
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  {[
                    [`${insight.turns}`, "轮对话"],
                    [`${insight.fieldCount}`, "个字段经对话记录"],
                    [`${insight.testsNarrated}`, "例测试为口述落表"],
                    [`${insight.grillAnswered}/${insight.grillAsked}`, "次拷问被正面作答"],
                  ].map(([n, label]) => (
                    <div key={label} className="border-l-2 border-brand-200 pl-2.5">
                      <p className="font-display tnum text-xl font-bold leading-6 text-ink-900">{n}</p>
                      <p className="mt-0.5 text-[11px] leading-4 text-ink-500">{label}</p>
                    </div>
                  ))}
                </div>
                {insight.highlights.length > 0 && (
                  <details className="group mt-3.5 border-t border-ink-900/10 pt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-ink-600 transition-colors duration-150 ease-soft hover:text-brand-600 [&::-webkit-details-marker]:hidden">
                      <svg
                        aria-hidden
                        className="h-3 w-3 shrink-0 transition-transform duration-150 ease-soft group-open:rotate-90"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                      查看拷问答摘录({insight.highlights.length}组)
                    </summary>
                    <ul className="mt-2.5 space-y-2">
                      {insight.highlights.map((h, i) => (
                        <li
                          key={i}
                          className="rounded-md border-l-2 border-brand-400 bg-brand-50/50 px-2.5 py-2"
                        >
                          <p className="flex items-start gap-1.5 text-xs font-medium leading-5 text-brand-700">
                            <Flame aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                            {h.q}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-ink-600">答:{h.answer}</p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {insight.firstAt && (
                  <p className="tnum mt-3 text-[11px] leading-4 text-ink-400">
                    留痕区间:{new Date(insight.firstAt).toLocaleDateString("zh-CN")} — {new Date(insight.lastAt ?? insight.firstAt).toLocaleDateString("zh-CN")}
                    {insight.expectedFollowups > 0 && ` · 补充预期 ${insight.expectedFollowups} 次`}
                  </p>
                )}
              </Card>
            </Reveal>
          )}
          <Reveal delayMs={200}>
            <ReviewForm
              assignmentId={assignment.id}
              locked={locked}
              initial={{
                problemDefinition: assignment.review?.problemDefinition ?? 5,
                originality: assignment.review?.originality ?? 5,
                closedLoop: assignment.review?.closedLoop ?? 5,
                evidence: assignment.review?.evidence ?? 5,
                bestValue: assignment.review?.bestValue ?? "",
                topImprovement: assignment.review?.topImprovement ?? "",
              }}
            />
          </Reveal>
          <Card title="回避">
            <p className="text-caption text-ink-500">
              与该作品存在利益关联时应回避;回避后不可恢复。
            </p>
            <RecuseButton assignmentId={assignment.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
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

  // 对话形成过程:材料在聊天中逐步长出来的留痕,佐证原创维度(提交后对话冻结,与快照时点一致)
  const messages = await chatHistory(params.id);
  const insight = chatInsight(messages);

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">评审:{assignment.project.title}</h1>
        <Link href="/judge" className="text-sm text-brand-600 hover:underline">← 返回工作台</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card title={`提交快照 v${snapshot.version} · ${new Date(snapshot.createdAt).toLocaleString("zh-CN")}`}>
          <p className="mb-3 text-xs text-slate-500">
            评审基于不可变提交快照;{card.header.track} · {card.header.team} · {card.header.members}
          </p>
          <div className="max-h-[70vh] space-y-4 overflow-auto pr-1">
            {card.sections.map((sec) => (
              <section key={sec.heading}>
                <h2 className="mb-1.5 border-l-4 border-brand-600 pl-2 text-sm font-semibold">{sec.heading}</h2>
                <dl className="space-y-1">
                  {sec.rows.map((r, i) => (
                    <div key={i} className="grid grid-cols-[120px_1fr] gap-2 text-xs">
                      <dt className="shrink-0 font-medium text-slate-500">{r.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-slate-800">{r.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <p className="mt-3">
            <a href={`/projects/${params.id}/card?version=${snapshot.version}`} target="_blank" className="text-xs text-brand-600 hover:underline">
              打开完整小实验卡与90秒Demo脚本 →
            </a>
          </p>
        </Card>

        <div className="space-y-3">
          {(insight.turns > 0 || insight.testsNarrated > 0) && (
            <Card title="对话形成过程 · 原创性佐证">
              <p className="mb-2 text-[11px] leading-4 text-slate-400">
                材料是否在对话中逐步形成、拷问是否被正面回答——供「原创过程与独立完成」维度参考,非评分依据本身。
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {[
                  [`${insight.turns}`, "轮对话"],
                  [`${insight.fieldCount}`, "个字段经对话记录"],
                  [`${insight.testsNarrated}`, "例测试为口述落表"],
                  [`${insight.grillAnswered}/${insight.grillAsked}`, "次拷问被正面作答"],
                ].map(([n, label]) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className="tnum font-display text-lg font-bold text-brand-700">{n}</span>
                    <span className="text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
              {insight.highlights.length > 0 && (
                <details className="group mt-2.5">
                  <summary className="cursor-pointer list-none text-[11px] text-slate-400 transition-colors hover:text-brand-600">
                    查看拷问答摘录({insight.highlights.length}组)
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {insight.highlights.map((h, i) => (
                      <li key={i} className="rounded border-l-2 border-brand-400 bg-brand-50/40 px-2 py-1.5">
                        <p className="text-[11px] font-medium leading-4 text-brand-800">🔥 {h.q}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-slate-600">答:{h.answer}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {insight.firstAt && (
                <p className="mt-2 text-[10px] text-slate-400">
                  留痕区间:{new Date(insight.firstAt).toLocaleDateString("zh-CN")} — {new Date(insight.lastAt ?? insight.firstAt).toLocaleDateString("zh-CN")}
                  {insight.expectedFollowups > 0 && ` · 补充预期 ${insight.expectedFollowups} 次`}
                </p>
              )}
            </Card>
          )}
          <ReviewForm
            assignmentId={assignment.id}
            locked={assignment.review?.status === "LOCKED"}
            initial={{
              problemDefinition: assignment.review?.problemDefinition ?? 5,
              originality: assignment.review?.originality ?? 5,
              closedLoop: assignment.review?.closedLoop ?? 5,
              evidence: assignment.review?.evidence ?? 5,
              bestValue: assignment.review?.bestValue ?? "",
              topImprovement: assignment.review?.topImprovement ?? "",
            }}
          />
          <Card title="回避">
            <p className="text-xs text-slate-500">与该作品存在利益关联时应回避;回避后不可恢复。</p>
            <RecuseButton assignmentId={assignment.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

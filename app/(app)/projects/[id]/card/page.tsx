import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Link2, Paperclip } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { judgeAssignmentIds } from "@/lib/api-helpers";
import { canViewProject, loadProjectBundle, precheckInputOf } from "@/lib/projects";
import { buildDemoScript, buildExperimentCard, buildVisibleResultChecklist } from "@/lib/deliverables";
import { PrintButton } from "@/components/print-button";

interface CardView {
  header: { title: string; track: string; team: string; members: string; slogan: string };
  sections: { heading: string; rows: { label: string; value: string }[] }[];
}

interface ScriptView {
  time: string;
  title: string;
  lines: string[];
}

export default async function CardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { version?: string; script?: string };
}) {
  const user = await requireUser();
  const bundle = await loadProjectBundle(params.id);
  if (!bundle) notFound();
  const judgeIds = user.role === "JUDGE" ? await judgeAssignmentIds(params.id) : undefined;
  if (!canViewProject(user, bundle, judgeIds)) notFound();

  let card: CardView;
  let script: ScriptView[];
  let checklist: { key: string; label: string; desc: string }[];
  let versionLabel: string;

  const version = Number(searchParams.version);
  if (Number.isInteger(version) && version > 0) {
    // 历史快照(不可变)
    const snap = await prisma.submissionSnapshot.findUnique({
      where: { projectId_version: { projectId: params.id, version } },
    });
    if (!snap) notFound();
    const payload = JSON.parse(snap.payload);
    card = payload.experimentCard;
    script = payload.demoScript;
    checklist = payload.visibleResultChecklist ?? [];
    versionLabel = `提交快照 v${snap.version} · ${new Date(snap.createdAt).toLocaleString("zh-CN")}`;
  } else {    const input = {
      ...precheckInputOf(bundle),
      title: bundle.project.title,
      teamName: bundle.team.name,
      memberNames: bundle.members.map((m) => m.name),
    };
    card = buildExperimentCard(input);
    script = buildDemoScript(input);
    checklist = buildVisibleResultChecklist();
    versionLabel = "当前内容(最新)";
  }

  // 可见结果材料(链接与上传文件),对有权查看者展示
  const attachmentRows = await prisma.attachment.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/projects/${params.id}?step=9`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 hover:underline"
        >
          <ArrowLeft size={14} strokeWidth={2.2} aria-hidden />
          返回项目
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">{versionLabel}</span>
          <PrintButton />
        </div>
      </div>

      {/* 一页小实验卡 */}
      <article className="print-page surface-card p-7 sm:p-9">
        <header className="border-b-2 border-ink-900 pb-4">
          <p className="kicker">小实验卡 · 三件套之一</p>
          <h1 className="font-display text-display-md mt-2 text-ink-900">{card.header.title}</h1>
          <p className="mt-2 text-sm text-ink-600">
            赛道:{card.header.track} · 队伍:{card.header.team} · 成员:{card.header.members}
          </p>
          <p className="mt-1 text-xs text-ink-400">{card.header.slogan}</p>
        </header>
        {card.sections.map((sec) => (
          <section key={sec.heading} className="mt-5">
            <h2 className="font-display mb-2 border-l-[3px] border-brand-600 pl-2.5 text-[14px] font-bold text-ink-900">
              {sec.heading}
            </h2>
            <dl className="space-y-1.5">
              {sec.rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[110px_1fr] gap-3 text-xs sm:grid-cols-[136px_1fr]">
                  <dt className="shrink-0 font-medium leading-5 text-ink-400">{r.label}</dt>
                  <dd className="whitespace-pre-wrap break-words leading-5 text-ink-800">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <footer className="mt-7 border-t border-ink-900/10 pt-2.5 text-[10px] leading-4 text-ink-400">
          本页由青年AI轻创导航站自动生成 · 原创声明与外部资源披露见上 · 仅供完善材料参考的预检分数不在此页呈现
        </footer>
      </article>

      {/* 可见结果清单 */}
      <article className="print-page surface-card p-7 sm:p-9">
        <p className="kicker">三件套之二</p>
        <h1 className="font-display text-display-md mt-2 text-ink-900">可见结果清单</h1>
        <p className="text-caption mt-2 text-ink-500">
          链接、截图、提示词、流程图、工作流、前后对比或可运行原型,准备其中适用的组合。
        </p>
        <ul className="mt-4 space-y-2 text-sm text-ink-700">
          {checklist.map((c) => (
            <li key={c.key} className="flex gap-2.5">
              <span className="mt-1 inline-block h-3 w-3 shrink-0 rounded-[3px] border border-ink-300 bg-white" aria-hidden />
              <span>
                <span className="font-medium text-ink-900">{c.label}</span>
                <span className="text-ink-500"> — {c.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        {attachmentRows.length > 0 && (
          <div className="mt-5 border-t border-ink-900/10 pt-4">
            <p className="mb-2 text-xs font-semibold text-ink-600">已提交材料({attachmentRows.length})</p>
            <ul className="space-y-1.5 text-sm">
              {attachmentRows.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="text-ink-400" aria-hidden>
                    {a.kind === "FILE" ? <Paperclip size={13} /> : <Link2 size={13} />}
                  </span>
                  <a
                    className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline"
                    href={a.kind === "FILE" ? `/api/attachments/${a.id}/download` : a.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.title}
                  </a>
                  {a.sizeKb != null && <span className="tnum text-xs text-ink-400">{a.sizeKb}KB</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {/* 90秒Demo脚本 */}
      <article className="print-page surface-card p-7 sm:p-9">
        <p className="kicker">三件套之三</p>
        <h1 className="font-display text-display-md mt-2 text-ink-900">90秒Demo脚本</h1>
        <p className="text-caption mt-2 text-ink-500">
          录屏,或3张截图加简短说明。按下方时间轴排练。
        </p>
        <ol className="mt-4 space-y-3">
          {script.map((seg) => (
            <li key={seg.time} className="rounded-lg border border-ink-900/10 bg-white p-3.5">
              <p className="text-xs font-bold text-brand-700">
                <span className="tnum">{seg.time}</span> {seg.title}
              </p>
              <ul className="mt-1.5 space-y-1 text-sm leading-6 text-ink-700">
                {seg.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </article>
    </div>
  );
}

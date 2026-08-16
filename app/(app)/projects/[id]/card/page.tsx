import { notFound } from "next/navigation";
import Link from "next/link";
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
        <Link href={`/projects/${params.id}?step=9`} className="text-sm text-brand-600 hover:underline">
          ← 返回项目
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{versionLabel}</span>
          <PrintButton />
        </div>
      </div>

      {/* 一页小实验卡 */}
      <article className="print-page rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <header className="border-b-2 border-slate-800 pb-3">
          <h1 className="text-xl font-bold">{card.header.title}</h1>
          <p className="mt-1 text-sm text-slate-600">
            赛道:{card.header.track} · 队伍:{card.header.team} · 成员:{card.header.members}
          </p>
          <p className="mt-1 text-xs text-slate-400">{card.header.slogan}</p>
        </header>
        {card.sections.map((sec) => (
          <section key={sec.heading} className="mt-4">
            <h2 className="mb-1.5 border-l-4 border-brand-600 pl-2 text-sm font-semibold">{sec.heading}</h2>
            <dl className="space-y-1">
              {sec.rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[130px_1fr] gap-2 text-xs">
                  <dt className="shrink-0 font-medium text-slate-500">{r.label}</dt>
                  <dd className="whitespace-pre-wrap break-words text-slate-800">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <footer className="mt-6 border-t border-slate-200 pt-2 text-[10px] text-slate-400">
          本页由青年AI轻创导航站自动生成 · 原创声明与外部资源披露见上 · 仅供完善材料参考的预检分数不在此页呈现
        </footer>
      </article>

      {/* 可见结果清单 */}
      <article className="print-page rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold">可见结果清单</h1>
        <p className="mt-1 text-xs text-slate-500">三项轻交付之二:链接、截图、提示词、流程图、工作流、前后对比或可运行原型,准备其中适用的组合。</p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
          {checklist.map((c) => (
            <li key={c.key} className="flex gap-2">
              <span className="text-slate-400">☐</span>
              <span>
                <span className="font-medium">{c.label}</span> — {c.desc}
              </span>
            </li>
          ))}
        </ul>
        {attachmentRows.length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1.5 text-xs font-semibold text-slate-600">已提交材料({attachmentRows.length})</p>
            <ul className="space-y-1 text-sm">
              {attachmentRows.map((a) => (
                <li key={a.id} className="flex items-center gap-2">
                  <span className="text-slate-400">{a.kind === "FILE" ? "📎" : "🔗"}</span>
                  <a
                    className="font-medium text-brand-600 hover:underline"
                    href={a.kind === "FILE" ? `/api/attachments/${a.id}/download` : a.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {a.title}
                  </a>
                  {a.sizeKb != null && <span className="text-xs text-slate-400">{a.sizeKb}KB</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {/* 90秒Demo脚本 */}
      <article className="print-page rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold">90秒Demo脚本</h1>
        <p className="mt-1 text-xs text-slate-500">三项轻交付之三:录屏,或3张截图加简短说明。按下方时间轴排练。</p>
        <ol className="mt-3 space-y-3">
          {script.map((seg) => (
            <li key={seg.time} className="rounded border border-slate-200 p-3">
              <p className="text-xs font-bold text-brand-700">{seg.time} {seg.title}</p>
              <ul className="mt-1 space-y-1 text-sm text-slate-700">
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

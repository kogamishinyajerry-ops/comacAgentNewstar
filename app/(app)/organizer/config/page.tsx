import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { ActivityForm } from "./activity-form";
import { TrackForm } from "./track-form";
import { ContentManager } from "./content-manager";
import { ActivatePromptButton } from "./activate-prompt-button";

export default async function OrganizerConfigPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const [activity, tracks, prompts, announcements, inspirations, officeHours] = await Promise.all([
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
    prisma.trackConfig.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.promptVersion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] }),
    prisma.inspirationCase.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.officeHour.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">活动配置与Prompt版本</h1>

      <ActivityForm
        initial={{
          name: activity?.name ?? "",
          slogan: activity?.slogan ?? "",
          intro: activity?.intro ?? "",
          startDate: activity?.startDate ?? "",
          endDate: activity?.endDate ?? "",
          submissionDeadline: activity?.submissionDeadline ?? "",
        }}
      />

      <Card title="赛道文案(固定四个,不可新增/删除)">
        <div className="space-y-4">
          {tracks.map((t) => (
            <TrackForm
              key={t.id}
              initial={{ id: t.id, name: t.name, description: t.description, suitable: t.suitable, unsuitable: t.unsuitable, example: t.example }}
            />
          ))}
        </div>
      </Card>

      <Card title="Prompt 版本管理">
        <ul className="space-y-2 text-sm">
          {prompts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-100 p-2">
              <span className="flex items-center gap-2">
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{p.version}</code>
                <Badge tone="gray">{p.purpose === "COACH" ? "辅导" : "预检"}</Badge>
                {p.active && <Badge tone="green">当前生效</Badge>}
                <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleString("zh-CN")}</span>
              </span>
              <details className="min-w-0 flex-1">
                <summary className="cursor-pointer text-xs text-slate-500">查看System Prompt</summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-[10px] text-slate-600">{p.systemPrompt}</pre>
              </details>
              {!p.active && <ActivatePromptButton id={p.id} />}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">每次Agent调用都会记录所用的Prompt版本,便于追溯。</p>
      </Card>

      <ContentManager
        announcements={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned }))}
        inspirations={inspirations.map((i) => ({ id: i.id, title: i.title, summary: i.summary, track: i.track, tags: i.tags }))}
        officeHours={officeHours.map((o) => ({ id: o.id, title: o.title, host: o.host, time: o.time, place: o.place, capacity: o.capacity }))}
      />
    </div>
  );
}

import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Badge, Card } from "@/components/ui";
import { Reveal } from "@/components/fx";
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
    <div className="space-y-5 py-2">
      <Reveal>
        <header>
          <p className="kicker">Activity Config</p>
          <h1 className="font-display mt-2 text-display-lg text-ink-900">活动配置与Prompt版本</h1>
          <p className="mt-2 max-w-2xl text-caption text-ink-500">
            活动事实、赛道文案、辅导与预检的 Prompt 版本,以及公告/灵感/Office Hour 内容。
          </p>
        </header>
      </Reveal>

      <Reveal delayMs={70}>
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
      </Reveal>

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
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-md border border-ink-900/10 bg-[#fffdf8] px-3 py-2.5 transition-colors duration-150 hover:border-ink-900/20"
            >
              <span className="flex flex-wrap items-center gap-2">
                <code className="tnum rounded border border-ink-900/10 bg-ink-50 px-1.5 py-0.5 text-xs font-medium text-ink-700">{p.version}</code>
                <Badge tone="gray">{p.purpose === "COACH" ? "辅导" : "预检"}</Badge>
                {p.active && <Badge tone="green">当前生效</Badge>}
                <span className="tnum text-xs text-ink-500">{new Date(p.createdAt).toLocaleString("zh-CN")}</span>
              </span>
              <details className="group min-w-0 flex-1 basis-full sm:basis-auto">
                <summary className="cursor-pointer select-none text-xs font-medium text-ink-500 transition-colors hover:text-brand-600">
                  查看System Prompt
                </summary>
                <pre className="mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-ink-900/10 bg-ink-50/60 p-2.5 text-[10px] leading-4 text-ink-600">{p.systemPrompt}</pre>
              </details>
              {!p.active && <ActivatePromptButton id={p.id} version={p.version} />}
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-ink-900/10 pt-2.5 text-xs leading-5 text-ink-500">
          每次Agent调用都会记录所用的Prompt版本,便于追溯。
        </p>
      </Card>

      <ContentManager
        announcements={announcements.map((a) => ({ id: a.id, title: a.title, body: a.body, pinned: a.pinned }))}
        inspirations={inspirations.map((i) => ({ id: i.id, title: i.title, summary: i.summary, track: i.track, tags: i.tags }))}
        officeHours={officeHours.map((o) => ({ id: o.id, title: o.title, host: o.host, time: o.time, place: o.place, capacity: o.capacity }))}
      />
    </div>
  );
}

import { Pin } from "lucide-react";
import { prisma } from "@/lib/db";
import { EmptyState, cn } from "@/components/ui";
import { Reveal } from "@/components/fx";

export default async function AnnouncementsPage() {
  const items = await prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="mx-auto max-w-3xl py-6">
      <Reveal>
        <header className="mb-8">
          <p className="kicker">Bulletin</p>
          <h1 className="font-display mt-2 text-display-lg text-ink-900">公告</h1>
          <p className="mt-2 text-caption text-ink-500">组织者的正式通知,按重要程度与时间排列。</p>
        </header>
      </Reveal>
      {items.length === 0 ? (
        <EmptyState title="暂无公告" />
      ) : (
        <Reveal delayMs={80}>
          <ol className="border-t border-ink-900/10">
            {items.map((a) => (
              <li key={a.id}>
                <article
                  className={cn(
                    "grid gap-2 border-b border-ink-900/10 py-6 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-6",
                    a.pinned && "bg-brand-50/40"
                  )}
                >
                  <time
                    dateTime={a.createdAt.toISOString()}
                    className={cn("tnum text-caption text-ink-500 sm:pt-1 sm:text-right", a.pinned && "sm:pl-3")}
                  >
                    {new Date(a.createdAt).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" })}
                  </time>
                  <div className={cn("min-w-0", a.pinned && "sm:pr-3")}>
                    <h2 className="font-display flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink-900">
                      {a.pinned && (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-0.5 text-micro font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                          <Pin size={10} strokeWidth={2.5} aria-hidden />
                          置顶
                        </span>
                      )}
                      {a.title}
                    </h2>
                    <p className="mt-2 whitespace-pre-wrap text-body text-ink-600">{a.body}</p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </Reveal>
      )}
    </div>
  );
}

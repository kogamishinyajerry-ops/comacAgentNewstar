import { prisma } from "@/lib/db";
import { EmptyState, Badge } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { TRACKS } from "@/lib/constants";

export default async function InspirationsPage() {
  const cases = await prisma.inspirationCase.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="py-6">
      <Reveal>
        <header className="mb-8 max-w-2xl">
          <p className="kicker">Case Library</p>
          <h1 className="font-display mt-2 text-display-lg text-ink-900">案例灵感库</h1>
          <p className="mt-2 text-lead text-ink-500">看看同类小实验长什么样,再回去想你的真问题。</p>
        </header>
      </Reveal>
      {cases.length === 0 ? (
        <EmptyState title="灵感库正在建设中" desc="组织者会陆续发布案例。" />
      ) : (
        <Reveal delayMs={80}>
          <ol className="grid gap-4 md:grid-cols-2">
            {cases.map((c, i) => (
              <li key={c.id}>
                <article className="surface-card surface-card-hover flex h-full flex-col p-5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="tnum text-micro font-semibold text-ink-300">
                      CASE {String(i + 1).padStart(2, "0")}
                    </span>
                    {c.track && (
                      <Badge tone="gray">{TRACKS.find((t) => t.key === c.track)?.name ?? c.track}</Badge>
                    )}
                  </div>
                  <h2 className="font-display mt-2.5 text-[18px] font-bold leading-snug tracking-tight text-ink-900">
                    {c.title}
                  </h2>
                  <p className="mt-2 flex-1 text-body text-ink-600">{c.summary}</p>
                  {c.tags.trim() && (
                    <p className="mt-4 flex flex-wrap gap-1.5 border-t border-ink-900/10 pt-3">
                      {c.tags
                        .split(/[,，]/)
                        .filter(Boolean)
                        .map((tag) => (
                          <Badge key={tag} tone="gray">{tag.trim()}</Badge>
                        ))}
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        </Reveal>
      )}
    </div>
  );
}

import { prisma } from "@/lib/db";
import { Card, EmptyState, Badge } from "@/components/ui";
import { TRACKS } from "@/lib/constants";

export default async function InspirationsPage() {
  const cases = await prisma.inspirationCase.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4 py-4">
      <div>
        <h1 className="text-xl font-semibold">案例灵感库</h1>
        <p className="mt-1 text-sm text-slate-500">看看同类小实验长什么样,再回去想你的真问题。</p>
      </div>
      {cases.length === 0 ? (
        <EmptyState title="灵感库正在建设中" desc="组织者会陆续发布案例。" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {cases.map((c) => (
            <Card key={c.id} title={c.title}>
              <p className="text-sm text-slate-600">{c.summary}</p>
              <p className="mt-2 flex flex-wrap gap-1">
                {c.track && <Badge tone="indigo">{TRACKS.find((t) => t.key === c.track)?.name ?? c.track}</Badge>}
                {c.tags
                  .split(/[,，]/)
                  .filter(Boolean)
                  .map((tag) => (
                    <Badge key={tag} tone="gray">{tag.trim()}</Badge>
                  ))}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

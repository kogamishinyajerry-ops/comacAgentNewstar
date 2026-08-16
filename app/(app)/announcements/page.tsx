import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export default async function AnnouncementsPage() {
  const items = await prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <h1 className="text-xl font-semibold">公告</h1>
      {items.length === 0 ? (
        <EmptyState title="暂无公告" />
      ) : (
        items.map((a) => (
          <Card key={a.id} title={<span className="flex items-center gap-2">{a.pinned && <Badge tone="amber">置顶</Badge>}{a.title}</span>}>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{a.body}</p>
            <p className="mt-2 text-xs text-slate-400">{new Date(a.createdAt).toLocaleString("zh-CN")}</p>
          </Card>
        ))
      )}
    </div>
  );
}

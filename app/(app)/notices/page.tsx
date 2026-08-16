import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import { NoticeList } from "../projects/workspace-notices";

export default async function NoticesPage() {
  const user = await requireUser();
  const rows = await prisma.notice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-4">
      <h1 className="text-xl font-semibold">站内通知</h1>
      <Card>
        <NoticeList
          initial={rows.map((n) => ({
            id: n.id,
            title: n.title,
            body: n.body,
            link: n.link,
            read: !!n.readAt,
            createdAt: n.createdAt.toISOString(),
          }))}
        />
      </Card>
    </div>
  );
}

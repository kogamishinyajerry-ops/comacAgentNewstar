import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { EmptyState, LinkButton } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { NoticeList } from "../projects/workspace-notices";

export default async function NoticesPage() {
  const user = await requireUser();
  const rows = await prisma.notice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const unread = rows.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-2xl py-6">
      <Reveal>
        <header className="mb-8 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="kicker">Inbox</p>
            <h1 className="font-display mt-2 text-display-lg text-ink-900">站内通知</h1>
          </div>
          {rows.length > 0 && (
            <p className="text-caption text-ink-500">
              {unread > 0 ? (
                <>
                  <span className="tnum font-semibold text-brand-600">{unread}</span> 条未读 · 点开即标记已读
                </>
              ) : (
                "全部已读"
              )}
            </p>
          )}
        </header>
      </Reveal>
      {rows.length === 0 ? (
        <Reveal delayMs={80}>
          <EmptyState
            title="暂无通知"
            desc="评审进展、组队动态和 Office Hour 提醒会推送到这里;先去首页看看活动路径,或到灵感库找找题目方向。"
            action={
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <LinkButton href="/home" size="sm">回到首页</LinkButton>
                <LinkButton href="/inspirations" variant="secondary" size="sm">案例灵感</LinkButton>
              </div>
            }
          />
        </Reveal>
      ) : (
        <Reveal delayMs={80}>
          <div className="surface-card p-3 sm:p-4">
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
          </div>
        </Reveal>
      )}
    </div>
  );
}

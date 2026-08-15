import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Card, EmptyState } from "@/components/ui";
import { SignupButton } from "./signup-button";

export default async function OfficeHoursPage() {
  const [items, user] = await Promise.all([
    prisma.officeHour.findMany({ orderBy: { createdAt: "desc" } }),
    getCurrentUser(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <h1 className="text-xl font-semibold">Office Hour</h1>
      <p className="text-sm text-slate-500">带具体问题来,30分钟小范围交流;报名后链接由组织者发送。</p>
      {items.length === 0 ? (
        <EmptyState title="暂无排期" desc="组织者会发布后续场次。" />
      ) : (
        items.map((o) => {
          const signups: string[] = JSON.parse(o.signups || "[]");
          const joined = !!user && signups.includes(user.id);
          return (
            <Card
              key={o.id}
              title={o.title}
              actions={<Badge tone={signups.length >= o.capacity ? "red" : "green"}>{signups.length}/{o.capacity}人</Badge>}
            >
              <p className="text-sm text-slate-600">主持人:{o.host}</p>
              <p className="text-sm text-slate-600">时间:{o.time}</p>
              <p className="text-sm text-slate-600">地点:{o.place}</p>
              <div className="mt-2">
                {user ? (
                  <SignupButton officeHourId={o.id} joined={joined} full={signups.length >= o.capacity} />
                ) : (
                  <p className="text-xs text-slate-400">登录后可报名</p>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

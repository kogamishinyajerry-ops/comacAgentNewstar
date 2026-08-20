import { CalendarDays, MapPin, User } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, EmptyState, ProgressBar } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { SignupButton } from "./signup-button";

export default async function OfficeHoursPage() {
  const [items, user] = await Promise.all([
    prisma.officeHour.findMany({ orderBy: { createdAt: "desc" } }),
    getCurrentUser(),
  ]);
  return (
    <div className="mx-auto max-w-3xl py-6">
      <Reveal>
        <header className="mb-8">
          <p className="kicker">Office Hour</p>
          <h1 className="font-display mt-2 text-display-lg text-ink-900">Office Hour</h1>
          <p className="mt-2 max-w-xl text-lead text-ink-500">
            带具体问题来,30分钟小范围交流;报名后链接由组织者发送。
          </p>
        </header>
      </Reveal>
      {items.length === 0 ? (
        <EmptyState title="暂无排期" desc="组织者会发布后续场次。" />
      ) : (
        <ol className="space-y-4">
          {items.map((o, i) => {
            const signups: string[] = JSON.parse(o.signups || "[]");
            const joined = !!user && signups.includes(user.id);
            const full = signups.length >= o.capacity;
            return (
              <li key={o.id}>
                <Reveal delayMs={i === 0 ? 80 : 0}>
                  <article className="surface-card surface-card-hover p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="tnum text-micro font-semibold text-ink-300">
                          SESSION {String(items.length - i).padStart(2, "0")}
                        </p>
                        <h2 className="font-display mt-1.5 text-[19px] font-bold tracking-tight text-ink-900">
                          {o.title}
                        </h2>
                      </div>
                      <Badge tone={full ? "red" : "green"}>
                        <span className="tnum">{signups.length}/{o.capacity}</span>人
                      </Badge>
                    </div>
                    <dl className="mt-4 grid gap-x-6 gap-y-2 text-caption text-ink-600 sm:grid-cols-3">
                      <div className="flex items-center gap-2">
                        <User size={13} className="shrink-0 text-ink-400" aria-hidden />
                        <dt className="sr-only">主持人</dt>
                        <dd>{o.host}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays size={13} className="shrink-0 text-ink-400" aria-hidden />
                        <dt className="sr-only">时间</dt>
                        <dd>{o.time}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="shrink-0 text-ink-400" aria-hidden />
                        <dt className="sr-only">地点</dt>
                        <dd>{o.place}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 border-t border-ink-900/10 pt-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-[160px] flex-1 sm:max-w-[240px]">
                          <ProgressBar pct={(signups.length / Math.max(1, o.capacity)) * 100} tone={full ? "amber" : "brand"} height="h-1" />
                          <p className="mt-1.5 text-micro text-ink-500">
                            {full ? "本场已满" : `还剩 ${o.capacity - signups.length} 个名额`}
                          </p>
                        </div>
                        {user ? (
                          <SignupButton officeHourId={o.id} joined={joined} full={full} />
                        ) : (
                          <p className="text-caption text-ink-400">登录后可报名</p>
                        )}
                      </div>
                    </div>
                  </article>
                </Reveal>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

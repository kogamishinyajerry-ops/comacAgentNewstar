import Link from "next/link";
import { site } from "@/config/site";
import { activity, activityFact, PENDING_LABEL } from "@/config/activity";

export function HubFooter() {
  return (
    <footer className="hub-footer">
      <div className="hub-container">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-[15px] font-bold">{site.brand.name}</p>
            <p className="hub-body mt-2 max-w-[380px] !text-[14px]">{site.positioning}</p>
            <p className="hub-caption mt-4">
              本站为活动公共入口的阶段一实现;登录后完整流程将在活动配置确认后开放。
            </p>
          </div>

          <nav aria-label="页脚导航" className="flex flex-col gap-2.5">
            <p className="text-[13px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">导航</p>
            {site.nav.map((item) => (
              <Link key={item.href} href={item.href} className="hub-quiet-link !text-[14px]">
                {item.label}
              </Link>
            ))}
            <Link href="/guide" className="hub-quiet-link !text-[14px]">活动指南</Link>
          </nav>

          <div className="flex flex-col gap-2.5">
            <p className="text-[13px] font-semibold tracking-[0.06em] text-[var(--text-tertiary)]">活动信息</p>
            <p className="hub-caption">
              主办单位:
              {activity.organizers.length > 0
                ? activity.organizers.join(" · ")
                : ` ${PENDING_LABEL}`}
            </p>
            <p className="hub-caption">活动时间:{activityFact(activity.dates.startDate)} 起</p>
            <p className="hub-caption">报名方式:{activityFact(activity.links.registration)}</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="hub-caption">{site.brand.name} · 公共网页 Hub</p>
          <p className="hub-caption">
            AI 拥有流程能力,不拥有人的裁决权 —— 参赛、评审与组织决定始终由人做出
          </p>
        </div>
      </div>
    </footer>
  );
}

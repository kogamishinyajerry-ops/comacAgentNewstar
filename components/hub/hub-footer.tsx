import Link from "next/link";
import { site } from "@/config/site";
import { activity, activityFact, PENDING_LABEL } from "@/config/activity";

/** 活动事实行:未确认项用 pending 章呈现——诚实的等待态也是设计的一部分。 */
function FactRow({ label, value }: { label: string; value: string }) {
  const pending = value === PENDING_LABEL;
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[12px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
        {label}
      </dt>
      <dd className="text-[14px] leading-relaxed text-[var(--text-primary)]">
        {pending ? <span className="hub-pending">{PENDING_LABEL}</span> : value}
      </dd>
    </div>
  );
}

export function HubFooter() {
  return (
    <footer className="hub-footer">
      <div className="hub-container">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="flex items-center gap-2.5 text-[15px] font-bold text-[var(--text-primary)]">
              <span className="hub-brand-rule" aria-hidden="true" />
              {site.brand.name}
            </p>
            <p className="hub-body mt-4 max-w-[380px] !text-[14.5px]">{site.positioning}</p>
            <p className="hub-caption mt-5 max-w-[380px]">
              本站为活动公共入口;登录与完整实践流程将在活动配置确认后开放。
            </p>
          </div>

          <nav aria-label="页脚导航" className="flex flex-col gap-3">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
              导航
            </p>
            {site.nav.map((item) => (
              <Link key={item.href} href={item.href} className="hub-quiet-link !text-[14px]">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-5">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">
              活动信息
            </p>
            <dl className="flex flex-col gap-5">
              <FactRow
                label="主办单位"
                value={
                  activity.organizers.length > 0
                    ? activity.organizers.join(" · ")
                    : PENDING_LABEL
                }
              />
              <FactRow label="活动时间" value={activityFact(activity.dates.startDate)} />
              <FactRow label="报名方式" value={activityFact(activity.links.registration)} />
            </dl>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-[var(--hairline)] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="hub-caption">{site.brand.name} · 公共网页 Hub</p>
          <p className="hub-caption">
            AI 拥有流程能力,不拥有人的裁决权 —— 参赛、评审与组织决定始终由人做出
          </p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { site } from "@/config/site";
import { CoachOrb } from "./coach-orb";

/** 首屏三拍：活动定位与主张 → 平面 Coach 标记 → 两个入口。 */
export function Hero() {
  return (
    <section
      className="hub-hero relative overflow-hidden"
      aria-label="活动定位"
      data-hub-hero
    >
      <div className="hub-container">
        <div className="hub-hero-grid">
          <div className="hero-beat-1 lg:[grid-area:text]">
            <p className="hub-eyebrow">{site.hero.eyebrow}</p>
            <h1 className="hub-display mt-5" aria-label={site.hero.title}>
              <span aria-hidden="true" className="block">把一个真实问题,</span>
              <span aria-hidden="true" className="block">变成可验证的</span>
              <span aria-hidden="true" className="block">AI Agent 作品</span>
            </h1>
            <p className="hub-lead mt-6 max-w-[560px]">{site.hero.subtitle}</p>
          </div>

          <div className="hero-beat-2 hub-hero-art lg:[grid-area:orb]">
            <CoachOrb state="idle" idPrefix="hero-orb" size={430} className="hidden sm:block" />
            <CoachOrb state="idle" idPrefix="hero-orb-m" size={248} className="sm:hidden" />
          </div>

          <div className="hero-beat-3 flex flex-col gap-4 lg:[grid-area:cta] lg:mt-2">
            <div className="flex flex-wrap items-center gap-4">
              <Link href={site.hero.primaryAction.href} className="hub-btn hub-btn--primary">
                {site.hero.primaryAction.label}
              </Link>
              <Link href={site.hero.secondaryAction.href} className="hub-btn hub-btn--secondary">
                {site.hero.secondaryAction.label}
              </Link>
            </div>
            <Link href={site.hero.quietLink.href} className="hub-quiet-link self-start">
              {site.hero.quietLink.label}
            </Link>
          </div>
        </div>
        <p className="atlas-hero-note hero-beat-3">一次只做一个决定</p>
      </div>
    </section>
  );
}

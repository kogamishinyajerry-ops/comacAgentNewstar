import Link from "next/link";
import { site } from "@/config/site";
import { CoachOrb } from "./coach-orb";

/**
 * 首屏:品牌与标题 → Coach 光核 → 双入口,三拍编排(总时长 ≤1.2s,见 tokens.css)。
 * 主标题与光核共同构成一个中心;首屏在 1440×900 内完整呈现。
 */
export function Hero() {
  return (
    <section
      className="relative flex min-h-[calc(100dvh-68px)] items-center overflow-hidden"
      aria-label="活动定位"
    >
      {/* 画布底部的一线光感(装饰) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44"
        style={{
          background:
            "linear-gradient(to top, rgba(53,104,232,0.06), transparent)",
        }}
      />

      <div className="hub-container">
        <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8 lg:[grid-template-areas:'text_orb''cta_orb']">
          <div className="hero-beat-1 lg:[grid-area:text]">
            <p className="hub-eyebrow">{site.hero.eyebrow}</p>
            <h1 className="hub-display mt-5">{site.hero.title}</h1>
            <p className="hub-lead mt-6 max-w-[560px]">{site.hero.subtitle}</p>
          </div>

          <div className="hero-beat-2 flex justify-center lg:[grid-area:orb]">
            <CoachOrb state="idle" idPrefix="hero-orb" size={300} className="hidden sm:block" />
            <CoachOrb state="idle" idPrefix="hero-orb-m" size={210} className="sm:hidden" />
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
      </div>
    </section>
  );
}

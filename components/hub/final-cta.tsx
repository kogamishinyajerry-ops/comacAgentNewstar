import Link from "next/link";
import { Reveal } from "./reveal";

/**
 * 模块 H:终局 CTA。
 */
export function FinalCta() {
  return (
    <section className="hub-section" aria-labelledby="final-cta-title">
      <div className="hub-container">
        <Reveal>
          <div className="hub-card relative overflow-hidden px-7 py-14 text-center sm:px-12 sm:py-20">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40"
              style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(53,104,232,0.08), transparent)" }}
            />
            <p className="hub-eyebrow justify-center">开始</p>
            <h2 id="final-cta-title" className="hub-title mx-auto mt-4 max-w-[640px]">
              从一个具体问题开始,而不是从技术名词开始
            </h2>
            <p className="hub-body mx-auto mt-4 max-w-[460px]">
              三幕追问,大约五分钟。你会带走一颗问题种子,而不是一张待办清单。
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/start" className="hub-btn hub-btn--primary">开始一次问题探索</Link>
              <Link href="/guide" className="hub-btn hub-btn--secondary">查看活动指南</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "./reveal";

/**
 * 模块 H:终局 CTA。
 */
export function FinalCta() {
  return (
    <section
      className="hub-section atlas-section atlas-section--final"
      aria-labelledby="final-cta-title"
      data-atlas-chapter="06"
    >
      <div className="hub-container">
        <Reveal>
          <div className="atlas-final-sheet">
            <div>
              <p className="hub-eyebrow">开始</p>
              <h2 id="final-cta-title" className="hub-title mt-4 max-w-[640px]">
                从一个具体问题开始,而不是从技术名词开始
              </h2>
              <p className="hub-body mt-4 max-w-[480px]">
                三幕追问,大约五分钟。你会带走一颗问题种子,而不是一张待办清单。
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link href="/start" className="hub-btn hub-btn--primary">开始一次问题探索</Link>
                <Link href="/guide" className="hub-btn hub-btn--secondary">查看活动指南</Link>
              </div>
            </div>
            <div className="atlas-seed-art" aria-hidden="true">
              <Image
                src="/hub/art/problem-seed.png"
                alt=""
                width={360}
                height={360}
                sizes="(max-width: 767px) 220px, 360px"
                className="h-auto w-full"
                loading="eager"
                unoptimized
              />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

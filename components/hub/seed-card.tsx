import Link from "next/link";
import type { RefObject } from "react";
import { seedCopy } from "@/fixtures/coach-demo";
import type { QuestionSeed } from "@/lib/hub/coach-machine";

/**
 * 问题种子:三幕回答凝结出的草稿。
 * 不是"项目创建成功"——明确标注缺口,保持主张—证据—缺口的姿态。
 */
export function SeedCard({
  seed,
  headingRef,
  headingId = "coach-seed-title",
}: {
  seed: QuestionSeed;
  headingRef?: RefObject<HTMLHeadingElement>;
  headingId?: string;
}) {
  return (
    <section className="seed-card hub-card motion-condense p-7 sm:p-9" aria-labelledby={headingId}>
      <p className="seed-slot-label">{seedCopy.title}</p>
      <h2 ref={headingRef} id={headingId} tabIndex={-1} className="hub-title mt-2 text-[24px] sm:text-[27px]">
        {seedCopy.subtitle}
      </h2>

      <dl className="mt-7 flex flex-col gap-6">
        <div>
          <dt className="seed-slot-label">{seedCopy.slots.moment}</dt>
          <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
            {seed.moment}
          </dd>
        </div>
        <div>
          <dt className="seed-slot-label">{seedCopy.slots.impact}</dt>
          <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
            {seed.impact}
          </dd>
        </div>
        <div>
          <dt className="seed-slot-label">{seedCopy.slots.necessity}</dt>
          <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
            {seed.necessity}
          </dd>
        </div>
      </dl>

      <div className="mt-8 rounded-xl border border-dashed p-4 sm:p-5" style={{ borderColor: "var(--accent-gap)", background: "var(--accent-gap-soft)" }}>
        <p className="text-[13px] font-semibold" style={{ color: "var(--accent-gap)" }}>
          {seedCopy.gapsTitle}
        </p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {seed.gaps.map((gap) => (
            <li className="seed-gap" key={gap}>
              <span aria-hidden>◇</span>
              {gap}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <Link href={seedCopy.cta.href} className="hub-btn hub-btn--primary">
          {seedCopy.cta.label}
        </Link>
        <p className="hub-caption max-w-[300px]">{seedCopy.previewNote}</p>
      </div>
    </section>
  );
}

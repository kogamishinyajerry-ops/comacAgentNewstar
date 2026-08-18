import Link from "next/link";
import type { RefObject } from "react";
import { seedCopy } from "@/fixtures/coach-demo";
import type { QuestionSeed } from "@/lib/hub/coach-machine";

/**
 * 问题种子:三幕回答凝结出的草稿,按“主张—证据—缺口”组织。
 * 不是"项目创建成功"——明确标注缺口,不暗示已完成用户访谈、
 * Benchmark、Demo 或工程验证。
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
      <h1 ref={headingRef} id={headingId} tabIndex={-1} className="hub-title mt-2 text-[24px] sm:text-[27px]">
        {seedCopy.subtitle}
      </h1>

      <div className="seed-claim-grid mt-7">
        <div className="seed-claim-block" data-seed-claim>
          <p className="seed-claim-label">{seedCopy.structure.claim}</p>
          <dl className="mt-3 flex flex-col gap-4">
            <div>
              <dt className="seed-slot-label">{seedCopy.slots.moment}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {seed.moment}
              </dd>
            </div>
            <div>
              <dt className="seed-slot-label">{seedCopy.slots.necessity}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {seed.necessity}
              </dd>
            </div>
          </dl>
        </div>

        <div className="seed-claim-block" data-seed-evidence>
          <p className="seed-claim-label">{seedCopy.structure.evidence}</p>
          <dl className="mt-3">
            <dt className="seed-slot-label">{seedCopy.slots.impact}</dt>
            <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
              {seed.impact}
            </dd>
          </dl>
          <p className="hub-caption mt-3">{seedCopy.evidenceNote}</p>
        </div>

        <div
          className="seed-claim-block seed-claim-block--gaps rounded-xl border border-dashed p-4 sm:p-5"
          data-seed-gaps
          style={{ borderColor: "var(--accent-gap)", background: "var(--accent-gap-soft)" }}
        >
          <p className="seed-claim-label" style={{ color: "var(--accent-gap)" }}>
            {seedCopy.structure.gaps}
          </p>
          <p className="mt-2 text-[13px] font-semibold" style={{ color: "var(--accent-gap)" }}>
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

"use client";

import Link from "next/link";
import { useState, type CSSProperties, type RefObject } from "react";
import { seedCopy } from "@/fixtures/coach-demo";
import {
  composeSeedText,
  type ExportMeta,
  type QuestionSeed,
} from "@/lib/hub/coach-machine";
import styles from "./coach-workbench.module.css";

/** J-5(§31 H3):揭示拍溯源编排——回答摘录按会话时序依次落位,纯 CSS 一次编排;
    关键帧只在 no-preference 媒体查询内定义,reduce-motion 下全部立即可见 */
const REVEAL_STEP_MS = 140;

function revealStyle(order: number): CSSProperties {
  return { animationDelay: `${order * REVEAL_STEP_MS}ms` };
}

/**
 * 问题种子:三幕回答凝结出的草稿,按“主张—证据—缺口”组织。
 * 不是"项目创建成功"——明确标注缺口,不暗示已完成用户访谈、
 * Benchmark、Demo 或工程验证。
 */
export function SeedCard({
  seed,
  meta,
  headingRef,
  headingId = "coach-seed-title",
  onStartArtifact,
}: {
  seed: QuestionSeed;
  /** P0-1:导出可追述元信息(会话卡号 + 凝结时刻本地时钟) */
  meta: ExportMeta;
  headingRef?: RefObject<HTMLHeadingElement>;
  headingId?: string;
  /** 打磨轮⑦(§32 I3):grown 态单一主行动——卡内直启第四幕深化;
      场景演示页不传则不渲染该 CTA */
  onStartArtifact?: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  /* 剪贴板只在浏览器本地写入;无持久化,失败不阻塞任何流程 */
  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(composeSeedText(seed, meta));
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }
  return (
    <section className={`seed-card hub-card motion-condense p-7 sm:p-9 ${styles.seedCard}`} aria-labelledby={headingId}>
      <p className="seed-slot-label">{seedCopy.title}</p>
      <h1 ref={headingRef} id={headingId} tabIndex={-1} className="hub-title mt-2 text-[24px] sm:text-[27px]">
        {seedCopy.subtitle}
      </h1>

      <div className="seed-claim-grid mt-7">
        <div className={`seed-claim-block ${styles.claimBlock}`} data-seed-claim>
          <p className="seed-claim-label">{seedCopy.structure.claim}</p>
          <dl className="mt-3 flex flex-col gap-4">
            <div className="motion-slot-in" data-reveal-slot="moment" style={revealStyle(0)}>
              <dt className="seed-slot-label">{seedCopy.slots.moment}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {seed.moment}
              </dd>
            </div>
            <div className="motion-slot-in" data-reveal-slot="necessity" style={revealStyle(2)}>
              <dt className="seed-slot-label">{seedCopy.slots.necessity}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {seed.necessity}
              </dd>
            </div>
          </dl>
        </div>

        <div
          className={`seed-claim-block motion-slot-in ${styles.claimBlock}`}
          data-seed-evidence
          data-reveal-slot="impact"
          style={revealStyle(1)}
        >
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
                <span className={styles.gapMark} aria-hidden="true" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 打磨轮⑦(§32 I3):位置提示 + 单一主行动;次要与安静动作降级 */}
      <p className="hub-caption mt-7" data-seed-position>
        {seedCopy.nextStepHint}
      </p>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        {onStartArtifact && (
          <button
            type="button"
            className="hub-btn hub-btn--primary"
            data-seed-deepen-cta
            onClick={onStartArtifact}
          >
            {seedCopy.deepenCta}
          </button>
        )}
        <button type="button" className="hub-btn hub-btn--secondary" onClick={handleCopy}>
          复制问题种子
        </button>
        <Link href={seedCopy.cta.href} className="hub-quiet-link self-start">
          {seedCopy.cta.label} <span aria-hidden="true">→</span>
        </Link>
        <p className="hub-caption max-w-[300px]">{seedCopy.previewNote}</p>
      </div>

      {copyState !== "idle" && (
        <p role="status" className={`hub-caption mt-3 ${styles.copyStatus}`} data-seed-copy-status>
          {copyState === "done" && (
            <span className={`animate-scale-in ${styles.copyMark}`} aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="m5 12.5 4.5 4.5L19 7.5"
                  stroke="var(--accent-evidence)"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={24}
                  className="animate-check-draw"
                />
              </svg>
            </span>
          )}
          <span>
            {copyState === "done"
              ? "问题种子已复制为纯文本，可粘贴到你的笔记继续追问。"
              : "复制失败：当前环境未授权剪贴板，请手动摘录上方关键内容。"}
          </span>
        </p>
      )}
    </section>
  );
}

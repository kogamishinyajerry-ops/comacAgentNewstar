"use client";

import Link from "next/link";
import { useState, type CSSProperties, type RefObject } from "react";
import { artifactCopy, handoffCopy, seedCopy } from "@/fixtures/coach-demo";
import {
  composeArtifactText,
  type ExportMeta,
  type QuestionDefinition,
} from "@/lib/hub/coach-machine";
import styles from "./coach-workbench.module.css";

/** J-5(§31 H3):揭示拍溯源编排——六轮回答摘录按会话时序依次落位(纯 CSS 一次编排);
    关键帧只在 no-preference 媒体查询内定义,reduce-motion 下全部立即可见 */
const REVEAL_STEP_MS = 140;

function revealStyle(order: number): CSSProperties {
  return { animationDelay: `${order * REVEAL_STEP_MS}ms` };
}

/**
 * 问题定义 Artifact:三幕种子经三轮深化凝结的会话内产物。
 * 深化记录只是把追问显性化——缺口原样保留,不暗示已验证
 * (docs/product/05 §4 阶段1;§28)。
 * N1 终章交棒(§31 H4):复制带走是真实状态,后续节点一律 pending 诚实标注。
 */
export function ArtifactCard({
  artifact,
  meta,
  headingRef,
  headingId = "coach-artifact-title",
  onReturnToSeed,
  onRestart,
}: {
  artifact: QuestionDefinition;
  /** P0-1:导出可追述元信息(会话卡号 + 凝结时刻本地时钟) */
  meta: ExportMeta;
  headingRef?: RefObject<HTMLHeadingElement>;
  headingId?: string;
  onReturnToSeed: () => void;
  onRestart: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  /* 剪贴板只在浏览器本地写入;无持久化,失败不阻塞任何流程(与种子导出同法) */
  async function handleCopy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(composeArtifactText(artifact, meta));
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section
      className={`seed-card hub-card motion-condense p-7 sm:p-9 ${styles.seedCard}`}
      aria-labelledby={headingId}
      data-artifact-card
    >
      <p className="seed-slot-label">{artifactCopy.doneTitle}</p>
      <h1
        ref={headingRef}
        id={headingId}
        tabIndex={-1}
        className="hub-title mt-2 text-[24px] sm:text-[27px]"
      >
        {artifactCopy.doneSubtitle}
      </h1>

      <div className="seed-claim-grid mt-7">
        <div className={`seed-claim-block ${styles.claimBlock}`} data-seed-claim>
          <p className="seed-claim-label">{seedCopy.structure.claim}</p>
          <dl className="mt-3 flex flex-col gap-4">
            <div className="motion-slot-in" data-reveal-slot="moment" style={revealStyle(0)}>
              <dt className="seed-slot-label">{seedCopy.slots.moment}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {artifact.moment}
              </dd>
            </div>
            <div className="motion-slot-in" data-reveal-slot="necessity" style={revealStyle(2)}>
              <dt className="seed-slot-label">{seedCopy.slots.necessity}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {artifact.necessity}
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
              {artifact.impact}
            </dd>
          </dl>
          <p className="hub-caption mt-3">{seedCopy.evidenceNote}</p>
        </div>

        <div className={`seed-claim-block ${styles.claimBlock}`} data-artifact-deepening>
          <p className="seed-claim-label" style={{ color: "var(--accent-evidence)" }}>
            {artifactCopy.deepeningLabel}
          </p>
          <ol className="mt-3 flex flex-col gap-4">
            {artifact.deepenings.map((item, index) => (
              <li
                key={item.label}
                className={`motion-slot-in ${styles.deepeningItem}`}
                data-artifact-deepening-item
                data-reveal-slot={`deepening-${index}`}
                style={revealStyle(3 + index)}
              >
                <p className="seed-slot-label">{item.label}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--text-tertiary)]">
                  问:{item.question}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-[var(--text-primary)]">
                  答:{item.answer}
                </p>
              </li>
            ))}
          </ol>
          <p className="hub-caption mt-3">{artifactCopy.deepeningNote}</p>
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
            {artifact.gaps.map((gap) => (
              <li className="seed-gap" key={gap}>
                <span className={styles.gapMark} aria-hidden="true" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
        <button type="button" className="hub-btn hub-btn--primary" onClick={handleCopy}>
          {artifactCopy.copyLabel}
        </button>
        <button type="button" className="hub-btn hub-btn--secondary" onClick={onRestart}>
          重新开始
        </button>
        <button type="button" className="hub-quiet-link self-start" onClick={onReturnToSeed}>
          ← {artifactCopy.backToSeedLabel}
        </button>
        <p className="hub-caption max-w-[300px]">{seedCopy.previewNote}</p>
      </div>

      {copyState !== "idle" && (
        <p role="status" className={`hub-caption mt-3 ${styles.copyStatus}`} data-artifact-copy-status>
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
              ? "问题定义已复制为纯文本，可粘贴到你的笔记继续深化。"
              : "复制失败：当前环境未授权剪贴板，请手动摘录上方关键内容。"}
          </span>
        </p>
      )}

      {/* J-2:N1 终章交棒——第一步只反映真实复制状态;后续节点与链接一律 pending,
          不预支未开放节点的能力(docs/product/08 §4) */}
      <section className={`coach-handoff mt-8 ${styles.handoff}`} aria-label="接下来怎么继续" data-coach-handoff>
        <h2 className="seed-claim-label">{handoffCopy.title}</h2>
        <ol className={`mt-4 flex flex-col gap-3.5 ${styles.handoffList}`}>
          <li className="coach-handoff-step" data-handoff-step="copied" data-handoff-done={copyState === "done"}>
            <span className="coach-handoff-mark" aria-hidden="true">
              {copyState === "done" ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="m5 12.5 4.5 4.5L19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={24}
                    className="animate-check-draw"
                  />
                </svg>
              ) : (
                "1"
              )}
            </span>
            <span>
              {copyState === "done" ? handoffCopy.copiedDone : handoffCopy.copiedStep}
              {copyState !== "done" && (
                <span className="hub-caption ml-2">{handoffCopy.copiedPending}</span>
              )}
            </span>
          </li>
          <li className="coach-handoff-step" data-handoff-step="paste">
            <span className="coach-handoff-mark" aria-hidden="true">2</span>
            <span>
              {handoffCopy.pasteStep}
              <span className="hub-caption ml-2">〔{handoffCopy.pasteNote}〕</span>
            </span>
          </li>
          <li className="coach-handoff-step" data-handoff-step="n2">
            <span className="coach-handoff-mark" aria-hidden="true">3</span>
            <span>
              {handoffCopy.n2Step}
              <span className="hub-caption ml-2">〔{handoffCopy.n2Timing}〕</span>
            </span>
          </li>
        </ol>
        <Link href="/guide" className="hub-quiet-link mt-4 inline-block" data-handoff-guide>
          {handoffCopy.guideLabel} <span aria-hidden="true">→</span>
        </Link>
      </section>
    </section>
  );
}

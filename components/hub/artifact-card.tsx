"use client";

import { useState, type RefObject } from "react";
import { artifactCopy, seedCopy } from "@/fixtures/coach-demo";
import {
  composeArtifactText,
  type QuestionDefinition,
} from "@/lib/hub/coach-machine";

/**
 * 问题定义 Artifact:三幕种子经三轮深化凝结的会话内产物。
 * 深化记录只是把追问显性化——缺口原样保留,不暗示已验证
 * (docs/product/05 §4 阶段1;§28)。
 */
export function ArtifactCard({
  artifact,
  headingRef,
  headingId = "coach-artifact-title",
  onReturnToSeed,
  onRestart,
}: {
  artifact: QuestionDefinition;
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
      await navigator.clipboard.writeText(composeArtifactText(artifact));
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <section
      className="seed-card hub-card motion-condense p-7 sm:p-9"
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
        <div className="seed-claim-block" data-seed-claim>
          <p className="seed-claim-label">{seedCopy.structure.claim}</p>
          <dl className="mt-3 flex flex-col gap-4">
            <div>
              <dt className="seed-slot-label">{seedCopy.slots.moment}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {artifact.moment}
              </dd>
            </div>
            <div>
              <dt className="seed-slot-label">{seedCopy.slots.necessity}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
                {artifact.necessity}
              </dd>
            </div>
          </dl>
        </div>

        <div className="seed-claim-block" data-seed-evidence>
          <p className="seed-claim-label">{seedCopy.structure.evidence}</p>
          <dl className="mt-3">
            <dt className="seed-slot-label">{seedCopy.slots.impact}</dt>
            <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--text-primary)]">
              {artifact.impact}
            </dd>
          </dl>
          <p className="hub-caption mt-3">{seedCopy.evidenceNote}</p>
        </div>

        <div className="seed-claim-block" data-artifact-deepening>
          <p className="seed-claim-label" style={{ color: "var(--accent-evidence)" }}>
            {artifactCopy.deepeningLabel}
          </p>
          <ol className="mt-3 flex flex-col gap-4">
            {artifact.deepenings.map((item) => (
              <li key={item.label} data-artifact-deepening-item>
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
                <span aria-hidden>◇</span>
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
        <p role="status" className="hub-caption mt-3" data-artifact-copy-status>
          {copyState === "done"
            ? "问题定义已复制为纯文本，可粘贴到你的笔记继续深化。"
            : "复制失败：当前环境未授权剪贴板，请手动摘录上方关键内容。"}
        </p>
      )}
    </section>
  );
}

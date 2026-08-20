"use client";

import Link from "next/link";
import { coachIntroCopy, coachPrivacyNotice } from "@/fixtures/coach-demo";
import { arrivalSteps, PENDING_LABEL } from "@/config/activity";
import { COACH_STATE_LABELS, CoachOrb } from "./coach-orb";

/**
 * 旅程叙事轮(§31 H2,J-1):建立拍——第一幕尚无任何回答时的前置场景。
 * 回答三问:我在哪(到场三件套 G0)、要投入什么(6 问·约 10–15 分钟)、
 * 会得到什么(一张可带走的问题定义卡);隐私披露前置。
 * 一屏一焦点:此拍不渲染常驻小卡与回答器;顶栏只保留「返回活动指南」
 * (G1 防线:还有退路价值的时刻,出口不回退)。不是弹窗轮播;
 * 动效走 no-preference 媒体门控,prefers-reduced-motion 全降级。
 */
export function CoachIntroScene({
  guideHref,
  orbIdPrefix,
  onBegin,
}: {
  guideHref: string;
  orbIdPrefix: string;
  onBegin: () => void;
}) {
  return (
    <div className="coach-workspace-dialog coach-solo" data-phase="intro">
      <div className="coach-topbar">
        <Link href={guideHref} className="coach-topbar-back hub-quiet-link">
          ← 返回活动指南
        </Link>
        <span className="coach-topbar-spacer" aria-hidden="true" />
      </div>

      <div
        className="coach-conversation-scroll"
        data-coach-conversation-scroll
        tabIndex={0}
      >
        <div className="coach-state-hint">
          <CoachOrb state="idle" idPrefix={orbIdPrefix} size={72} decorative />
          <span className="coach-state-hint-label">AI Coach · {COACH_STATE_LABELS.idle}</span>
        </div>

        <div className="coach-intro motion-step-in" data-coach-intro>
          {/* 任一时刻只有一个语义主标题 */}
          <h1 className="coach-question" id="coach-intro-title">
            {coachIntroCopy.title}
          </h1>

          <section className="coach-intro-block" aria-label={coachIntroCopy.arrivalTitle}>
            <p className="seed-slot-label">{coachIntroCopy.arrivalTitle}</p>
            <ol className="coach-intro-steps mt-3">
              {arrivalSteps.map((step) => (
                <li
                  key={step.key}
                  className="coach-intro-step"
                  data-intro-step={step.key}
                  data-intro-current={step.current || undefined}
                >
                  <span className="coach-intro-step-index" aria-hidden="true">
                    {step.index}
                  </span>
                  <span>
                    <span className="coach-intro-step-title">
                      {step.title}
                      {step.current && <span className="hub-caption ml-2">（你在这里）</span>}
                    </span>
                    <span className="coach-intro-step-detail">
                      {step.href ? (
                        <a href={step.href} target="_blank" rel="noreferrer" className="hub-quiet-link">
                          {step.detail}
                        </a>
                      ) : (
                        step.detail
                      )}
                      {!step.current && !step.href && (
                        <span className="hub-caption ml-2">〔{PENDING_LABEL}〕</span>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="coach-intro-block" aria-label={coachIntroCopy.flowTitle}>
            <p className="seed-slot-label">{coachIntroCopy.flowTitle}</p>
            <ul className="coach-intro-flow mt-3">
              {coachIntroCopy.flowItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {/* 隐私披露前置:告知必须先于输入(§18 时序原则,建立拍同构) */}
          <p className="coach-privacy-note" data-coach-privacy-note>
            {coachPrivacyNotice}
          </p>
        </div>
      </div>

      {/* 回答器位置由唯一 CTA 接替:一屏一焦点,键盘 Tab 直达 */}
      <div className="coach-composer coach-composer--intro">
        <button
          type="button"
          className="hub-btn hub-btn--primary coach-intro-begin"
          aria-label={coachIntroCopy.beginAriaLabel}
          data-coach-begin
          onClick={onBegin}
        >
          {coachIntroCopy.beginLabel}
        </button>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { coachIntroCopy, coachPrivacyNotice } from "@/fixtures/coach-demo";
import { arrivalSteps, PENDING_LABEL } from "@/config/activity";
import { site } from "@/config/site";
import { COACH_STATE_LABELS, CoachOrb } from "./coach-orb";

/**
 * 旅程叙事轮(§31 H2,J-1):建立拍——第一幕尚无任何回答时的前置场景。
 * 回答三问:我在哪(到场三件套 G0)、要投入什么(6 问·约 10–15 分钟)、
 * 会得到什么(一张可带走的问题定义卡);隐私披露前置。
 * 一屏一焦点:此拍不渲染常驻小卡与回答器。
 * §35:顶栏不再承担页面跳转(左槽占位);入口选择前移到 CTA 区的次要链接
 * ——建立拍时尚无任何回答,这是零成本的起点决策,不是旅程中跳转。
 * 不是弹窗轮播;动效走 no-preference 媒体门控,prefers-reduced-motion 全降级。
 */
export function CoachIntroScene({
  orbIdPrefix,
  switchEntryHref,
  switchEntryLabel,
  onBegin,
}: {
  orbIdPrefix: string;
  /** §35:次要入口切换(如 problem → ?entry=idea);指向另一入口的建立拍 */
  switchEntryHref: string;
  switchEntryLabel: string;
  onBegin: () => void;
}) {
  return (
    <div className="coach-workspace-dialog coach-solo" data-phase="intro">
      <div className="coach-topbar">
        {/* §35:左槽占位——顶栏不再有「返回活动指南」出口,
            指南链接在回看抽屉页脚常驻可达;占位保持三栏布局稳定 */}
        <span className="coach-topbar-spacer" aria-hidden="true" />
        {/* §33 K2/K3:工作台无站点导航栏,顶栏中央给出流程位置与活动身份 */}
        <p className="coach-workspace-count">开始之前 · 到场与流程</p>
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

        <div className="coach-intro" data-coach-intro>
          {/* 入场编排(≤3 拍,总时长 ≤1.2s):标题 → 到场 → 流程与隐私;
              animate-rise 自带 opacity,reduced-motion 下全部直接可见 */}
          <div className="flex animate-rise flex-col gap-3">
            {/* 任一时刻只有一个语义主标题;眉行补活动身份(§33 K3:头部已移除) */}
            <p className="hub-eyebrow" data-coach-intro-brand>
              {site.brand.name}
            </p>
            <h1 className="hub-title" id="coach-intro-title">
              {coachIntroCopy.title}
            </h1>
          </div>

          <section
            className="coach-intro-block animate-rise"
            aria-label={coachIntroCopy.arrivalTitle}
            style={{ animationDelay: "90ms" }}
          >
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

          <section
            className="coach-intro-block animate-rise"
            aria-label={coachIntroCopy.flowTitle}
            style={{ animationDelay: "180ms" }}
          >
            <p className="seed-slot-label">{coachIntroCopy.flowTitle}</p>
            <ul className="coach-intro-flow mt-3">
              {coachIntroCopy.flowItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {/* 隐私披露前置:告知必须先于输入(§18 时序原则,建立拍同构) */}
          <p
            className="coach-privacy-note animate-rise"
            data-coach-privacy-note
            style={{ animationDelay: "250ms" }}
          >
            {coachPrivacyNotice}
          </p>
        </div>
      </div>

      {/* 回答器位置由唯一 CTA 接替:一屏一焦点,键盘 Tab 直达 */}
      <div className="coach-composer coach-composer--intro">
        <button
          type="button"
          className="hub-btn hub-btn--primary coach-intro-begin animate-fade-in"
          aria-label={coachIntroCopy.beginAriaLabel}
          data-coach-begin
          style={{ animationDelay: "320ms" }}
          onClick={onBegin}
        >
          {coachIntroCopy.beginLabel}
        </button>
        {/* §35:入口选择前移到建立拍——尚无任何回答,换入口是零成本起点决策;
            问题态/深化轮中不再出现任何入口切换链接 */}
        <Link
          href={switchEntryHref}
          className="coach-entry-quiet hub-quiet-link"
          data-coach-entry-switch
        >
          {switchEntryLabel}
        </Link>
      </div>
    </div>
  );
}

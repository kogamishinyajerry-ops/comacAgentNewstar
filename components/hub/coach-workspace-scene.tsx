"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { CoachAct } from "@/fixtures/coach-demo";
import {
  COACH_ATTACHMENT_ACCEPT,
  formatCoachAttachmentSize,
  type CoachAttachment,
} from "@/lib/hub/coach-attachment";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { CoachOrb } from "./coach-orb";
import type { CoachVisualState } from "@/lib/hub/coach-machine";

/** 幕间时序的子步骤:收拢 → 当前判断 → 最大风险(随后下一问成为唯一焦点) */
export type CoachTransitionStep = "collect" | "judgment" | "risk";

/** 回答器自动增高的上限(px),超出后输入框内部滚动 */
const COMPOSER_INPUT_MAX_HEIGHT = 144;

/**
 * 单焦点 Coach 场景(状态 A/B/C)。
 * 种子形成前不做完整工作台:极弱返回 + 幕号 + Coach 状态提示 +
 * 压缩结论轨迹 + 一个主问题 + 一个紧凑浮屿回答器(附件 / 输入 / 发送)。
 * 判断与风险是提交后的时间序列,不与下一问长期并列;
 * 过渡期回答器整体折叠,不留禁用的大输入框占据视觉中心。
 */
export function CoachWorkspaceScene({
  act,
  nextAct,
  traces,
  actIndex,
  actCount,
  value,
  error,
  transitioning,
  condensing,
  transitionStep,
  pending,
  attachment,
  attachmentError,
  attachmentNotice,
  privacyNotice,
  attachmentEnabled,
  attachmentReading,
  providerStatus,
  providerError,
  visual,
  visualLabel,
  orbIdPrefix,
  backHref,
  switchEntryHref,
  switchEntryLabel,
  onChange,
  onResponderFocus,
  onAttachmentSelect,
  onAttachmentRemove,
  onCancelWait,
  onSubmit,
}: {
  act: CoachAct;
  /** 正在进入的一幕;判断/风险时序只在其内容确定后端上 */
  nextAct: CoachAct | null;
  traces: readonly string[];
  actIndex: number;
  actCount: number;
  value: string;
  error: string | null;
  transitioning: boolean;
  condensing: boolean;
  transitionStep: CoachTransitionStep | null;
  pending: boolean;
  /** 当前已选中的文本附件;仅用于本轮 Chip 展示,随提交一次性发送 */
  attachment: CoachAttachment | null;
  attachmentError: string | null;
  /** 按需隐私确认文案(仅选中附件时出现) */
  attachmentNotice: string;
  /** 前置隐私披露:第1、2幕问题态常驻,告知回答将发送至 AI 服务 */
  privacyNotice: string;
  /** 仅第一、二幕开放附件;第三幕只在客户端凝结种子,不渲染附件入口 */
  attachmentEnabled: boolean;
  /** 附件读取中:禁用附件/提交按钮,读取落定前不允许提交 */
  attachmentReading: boolean;
  providerStatus: string | null;
  providerError: string | null;
  visual: CoachVisualState;
  visualLabel: string;
  orbIdPrefix: string;
  backHref: string;
  switchEntryHref: string;
  switchEntryLabel: string;
  onChange: (value: string) => void;
  onResponderFocus: (focused: boolean) => void;
  onAttachmentSelect: (file: File) => void;
  onAttachmentRemove: () => void;
  /** 等待期取消(可选):仅真实请求在途时渲染取消入口 */
  onCancelWait?: () => void;
  onSubmit: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const collectRef = useRef<HTMLSpanElement>(null);
  const judgmentRef = useRef<HTMLParagraphElement>(null);
  const riskRef = useRef<HTMLParagraphElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerDescription = [
    attachmentEnabled && attachment ? "coach-attachment-note" : null,
    error ? "coach-answer-error" : null,
    attachmentError ? "coach-attachment-error" : null,
  ]
    .filter(Boolean)
    .join(" ");

  /* 过渡期计数器先对齐到正在进入的一幕,不再滞后显示旧幕号 */
  const displayActIndex = transitioning ? Math.min(actIndex + 1, actCount - 1) : actIndex;

  /* 提交后回答器折叠,焦点会掉到 body;时序各拍显式落在对应步骤文本上,
     每拍自播报,不再依赖 aria-live 复述,避免同一内容重复朗读。 */
  useEffect(() => {
    if (transitionStep === "collect") collectRef.current?.focus();
    else if (transitionStep === "judgment") judgmentRef.current?.focus();
    else if (transitionStep === "risk") riskRef.current?.focus();
  }, [transitionStep]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    /* 新一幕问题端上后,焦点接续到回答器(回答器由问题标题命名) */
    if (!transitioning && actIndex > 0) {
      textareaRef.current?.focus();
    }
  }, [actIndex, traces.length, transitioning]);

  /* 自动增高:单行起步,随内容长到上限后出现内部滚动;
     提交清空或过渡折叠后重新挂载时回到单行 */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_INPUT_MAX_HEIGHT)}px`;
  }, [value, transitioning]);

  return (
    <div className="coach-workspace-dialog coach-solo" data-phase={transitioning ? "transition" : "question"}>
      <div className="coach-topbar">
        <Link href={backHref} className="coach-topbar-back hub-quiet-link">
          ← 返回活动指南
        </Link>
        <p className="coach-workspace-count" aria-label={`第 ${displayActIndex + 1} 幕，共 ${actCount} 幕`}>
          {String(displayActIndex + 1).padStart(2, "0")} / {String(actCount).padStart(2, "0")}
        </p>
        <Link href={switchEntryHref} className="coach-entry-quiet hub-quiet-link">
          {switchEntryLabel}
        </Link>
      </div>

      <div
        ref={scrollRef}
        className="coach-conversation-scroll"
        data-coach-conversation-scroll
        role="log"
        aria-label="Coach 会话记录"
        tabIndex={0}
      >
        <div className="coach-state-hint">
          <CoachOrb state={visual} idPrefix={orbIdPrefix} size={72} decorative />
          <span className="coach-state-hint-label">AI Coach · {visualLabel}</span>
        </div>

        {traces.length > 0 && (
          <ol className="coach-trace-list" aria-label="已完成的结论轨迹">
            {traces.map((line, index) => (
              <li className="coach-trace" key={`${index}-${line}`}>
                {line}
              </li>
            ))}
          </ol>
        )}

        {transitioning ? (
          <div className="coach-transition">
            {transitionStep === "collect" && (
              <p className="coach-step" data-transition-step="collect">
                <span ref={collectRef} tabIndex={-1} data-step-kind="collect" className="coach-step-text">
                  {condensing
                    ? "正在把三幕回答凝结成问题种子……"
                    : "Coach 正在收拢这一幕的回答……"}
                </span>
                {/* 等待期出口:仅在真实请求在途时出现;取消不是错误,
                    本幕立即改用本地确定性追问继续 */}
                {!condensing && pending && onCancelWait && (
                  <button type="button" className="coach-cancel-wait" onClick={onCancelWait}>
                    不再等待，改用确定性追问
                  </button>
                )}
              </p>
            )}
            {transitionStep === "judgment" && nextAct && (
              <section className="coach-step coach-step--judgment" data-transition-step="judgment" aria-label="当前判断">
                <p className="coach-step-label">当前判断</p>
                <p ref={judgmentRef} tabIndex={-1} data-step-kind="judgment" className="coach-step-text">
                  {nextAct.judgment}
                </p>
              </section>
            )}
            {transitionStep === "risk" && nextAct && (
              <section className="coach-step coach-step--risk" data-transition-step="risk" aria-label="最大风险">
                <p className="coach-step-label">最大风险</p>
                <p ref={riskRef} tabIndex={-1} data-step-kind="risk" className="coach-step-text">
                  {nextAct.risk}
                </p>
              </section>
            )}
          </div>
        ) : (
          <div className="coach-current">
            {/* 任一时刻只有一个语义主标题,且就是当前主问题 */}
            <h1 className="coach-question" id="coach-question">
              {act.question}
            </h1>
            {/* 断网 alert 已表达回退事实时,状态行不再重复同义文案 */}
            {providerStatus && !providerError && (
              <p className="coach-provider-status">{providerStatus}</p>
            )}
            {/* 隐私前置披露:第1、2幕的提交会发送至 AI 服务,告知必须先于输入,
                不能等到三幕全部完成后的种子卡(修正 F-d 的时序倒置) */}
            {attachmentEnabled && (
              <p className="coach-privacy-note" data-coach-privacy-note>
                {privacyNotice}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 过渡期整个回答器折叠:不留禁用的大输入框占据视觉中心 */}
      {!transitioning && (
        <form
          className="coach-composer"
          aria-busy={attachmentReading || undefined}
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="coach-composer-island">
            {attachmentEnabled && attachment && (
              <div className="coach-composer-attachment">
                <span className="coach-attachment-chip">
                  <span className="coach-attachment-name">{attachment.name}</span>
                  <span className="coach-attachment-size">
                    {formatCoachAttachmentSize(attachment.size)}
                  </span>
                  <button
                    type="button"
                    className="coach-attachment-remove"
                    aria-label={`移除附件 ${attachment.name}`}
                    onClick={onAttachmentRemove}
                  >
                    <X size={14} aria-hidden focusable={false} />
                  </button>
                </span>
                <p className="coach-attachment-note" id="coach-attachment-note">
                  {attachmentNotice}
                </p>
              </div>
            )}
            <div className="coach-composer-row">
              {attachmentEnabled && (
                <>
                  <button
                    type="button"
                    className="coach-composer-attach"
                    aria-label="添加文本附件（.txt/.md/.csv/.json，≤1MB）"
                    disabled={pending || attachmentReading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip size={20} aria-hidden focusable={false} />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={COACH_ATTACHMENT_ACCEPT}
                    className="coach-file-input"
                    aria-label="选择文本附件文件"
                    tabIndex={-1}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onAttachmentSelect(file);
                      /* 允许再次选择同一文件(值复位后 change 才会再次触发) */
                      event.target.value = "";
                    }}
                  />
                </>
              )}
              <label htmlFor="coach-answer" className="sr-only">
                你的回答
              </label>
              <textarea
                id="coach-answer"
                ref={textareaRef}
                className="hub-textarea coach-composer-input"
                placeholder={act.placeholder}
                value={value}
                rows={1}
                maxLength={600}
                aria-labelledby="coach-question"
                aria-describedby={answerDescription || undefined}
                aria-invalid={Boolean(error)}
                disabled={pending}
                onChange={(event) => onChange(event.target.value)}
                onFocus={() => onResponderFocus(true)}
                onBlur={() => onResponderFocus(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
              <button
                type="submit"
                className="coach-composer-send"
                aria-label="提交这一问的回答"
                disabled={pending || attachmentReading}
              >
                <ArrowUp size={20} aria-hidden focusable={false} />
              </button>
            </div>
          </div>
          {error && (
            <p className="hub-field-error coach-composer-error" id="coach-answer-error" role="alert">
              {error}
            </p>
          )}
          {attachmentError && (
            <p className="hub-field-error coach-composer-error" id="coach-attachment-error" role="alert">
              {attachmentError}
            </p>
          )}
          {providerError && (
            <p className="hub-field-error coach-composer-error" id="coach-provider-error" role="alert">
              {providerError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

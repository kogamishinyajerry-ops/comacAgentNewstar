"use client";

import { useEffect, useRef } from "react";
import type { CoachAct } from "@/fixtures/coach-demo";

export function CoachWorkspaceScene({
  act,
  resolvedActs,
  answers,
  actIndex,
  actCount,
  value,
  error,
  transitioning,
  pending,
  privacyNotice,
  providerStatus,
  providerError,
  onChange,
  onResponderFocus,
  onSubmit,
}: {
  act: CoachAct;
  resolvedActs: readonly CoachAct[];
  answers: readonly string[];
  actIndex: number;
  actCount: number;
  value: string;
  error: string | null;
  transitioning: boolean;
  pending: boolean;
  privacyNotice: string;
  providerStatus: string | null;
  providerError: string | null;
  onChange: (value: string) => void;
  onResponderFocus: (focused: boolean) => void;
  onSubmit: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerDescription = ["coach-answer-privacy", error ? "coach-answer-error" : null]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    if (actIndex > 0 && !transitioning) textareaRef.current?.focus();
  }, [actIndex, answers.length, transitioning]);

  return (
    <div className="coach-workspace-dialog" data-phase={transitioning ? "transition" : "question"}>
      <div className="coach-workspace-dialog-head">
        <div>
          <p className="coach-workspace-kicker">会话</p>
          <p className="coach-workspace-dialog-title">一次只处理一个决定</p>
        </div>
        <p className="coach-workspace-count" aria-label={`第 ${actIndex + 1} 幕，共 ${actCount} 幕`}>
          {String(actIndex + 1).padStart(2, "0")} / {String(actCount).padStart(2, "0")}
        </p>
      </div>

      <div
        ref={scrollRef}
        className="coach-conversation-scroll"
        data-coach-conversation-scroll
        role="log"
        aria-label="Coach 会话记录"
        tabIndex={0}
      >
        {answers.map((answer, index) => (
          <div className="coach-exchange" key={`${index}-${answer}`}>
            <article className="coach-message coach-message--coach" aria-label={`Coach 第 ${index + 1} 问`}>
              <p className="coach-message-author">Coach · 已完成</p>
              <p>{resolvedActs[index]?.question}</p>
            </article>
            <article className="coach-message coach-message--user" aria-label={`你的第 ${index + 1} 个回答`}>
              <p className="coach-message-author">你的回答</p>
              <p>{answer}</p>
            </article>
          </div>
        ))}

        <article className="coach-message coach-message--current" aria-current="step">
          <p className="coach-message-author">Coach · 当前问题</p>
          <h2 className="coach-question" id="coach-question">
            {act.question}
          </h2>
          {providerStatus && <p className="coach-provider-status">{providerStatus}</p>}
        </article>
      </div>

      <form
        className="coach-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="coach-answer" className="sr-only">
          你的回答
        </label>
        <textarea
          id="coach-answer"
          ref={textareaRef}
          className="hub-textarea coach-composer-input"
          placeholder={act.placeholder}
          value={value}
          rows={3}
          maxLength={600}
          aria-labelledby="coach-question"
          aria-describedby={answerDescription}
          aria-invalid={Boolean(error)}
          disabled={transitioning || pending}
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
        <div className="coach-composer-actions">
          <p className="coach-composer-note" id="coach-answer-privacy">
            {privacyNotice} Command/Ctrl + Enter 提交
          </p>
          <button
            type="submit"
            className="hub-btn hub-btn--primary"
            aria-label="提交这一问的回答"
            disabled={transitioning || pending}
          >
            {transitioning || pending ? "正在整理" : "提交回答"}
          </button>
        </div>
        {error && (
          <p className="hub-field-error" id="coach-answer-error" role="alert">
            {error}
          </p>
        )}
        {providerError && (
          <p className="hub-field-error" id="coach-provider-error" role="alert">
            {providerError}
          </p>
        )}
      </form>
    </div>
  );
}

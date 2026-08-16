"use client";

import { useEffect, useRef } from "react";
import type { CoachAct } from "@/fixtures/coach-demo";

/**
 * 一幕:当前判断 / 最大风险 / 一个关键问题 / 一个回答器。
 * 逻辑四层在同一场景内以字号与留白分层,不拆成审计卡(docs/product/02 §3.2)。
 */
export function CoachScene({
  act,
  actIndex,
  actCount,
  entryLabel,
  value,
  error,
  transitioning,
  condensing,
  onChange,
  onResponderFocus,
  onSubmit,
}: {
  act: CoachAct;
  actIndex: number;
  actCount: number;
  entryLabel: string;
  value: string;
  error: string | null;
  transitioning: boolean;
  condensing: boolean;
  onChange: (v: string) => void;
  onResponderFocus: (focused: boolean) => void;
  onSubmit: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* 首幕不抢焦点;后续幕在用户刚提交后接续焦点,键盘路径不断 */
  useEffect(() => {
    if (actIndex > 0 && !transitioning) {
      textareaRef.current?.focus();
    }
  }, [actIndex, transitioning]);

  return (
    <div
      className="coach-act"
      data-phase={transitioning ? "transition" : "question"}
      data-condensing={condensing ? "true" : "false"}
      key={actIndex}
    >
      <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:gap-14">
        <aside aria-label="Coach 的当前读法" className="coach-meta">
          <dl className="flex flex-col gap-5">
            <div>
              <dt>当前判断</dt>
              <dd className="mt-1">{act.judgment}</dd>
            </div>
            <div>
              <dt>最大风险</dt>
              <dd className="mt-1">{act.risk}</dd>
            </div>
          </dl>
          <p className="hub-caption mt-5">
            {entryLabel} · 第 {actIndex + 1} 幕 / 共 {actCount} 幕
          </p>
        </aside>

        <div className="min-w-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            <label htmlFor="coach-answer" className="sr-only">
              你的回答
            </label>
            <h3 className="coach-question" id="coach-question">
              {act.question}
            </h3>
            <textarea
              id="coach-answer"
              ref={textareaRef}
              className="hub-textarea mt-6"
              placeholder={act.placeholder}
              value={value}
              rows={4}
              maxLength={600}
              aria-describedby={error ? "coach-answer-error" : undefined}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => onResponderFocus(true)}
              onBlur={() => onResponderFocus(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />
            {error && (
              <p className="hub-field-error mt-2.5" id="coach-answer-error" role="alert">
                <span aria-hidden>↖</span>
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <button type="submit" className="hub-btn hub-btn--primary">
                提交这一问的回答
              </button>
              <span className="hub-caption">回答只保存在本页 · ⌘/Ctrl + Enter 可直接提交</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

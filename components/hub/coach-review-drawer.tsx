"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { coachProgressCopy } from "@/fixtures/coach-demo";
import type { ReviewRound } from "@/lib/hub/coach-machine";
import styles from "./coach-workbench.module.css";

/**
 * 打磨轮⑥(§29):回看抽屉——完整的逐轮问答与当前位置。
 * 模态对话框(Esc/背景关闭/焦点陷阱,关闭后焦点回触发器);
 * 未打开时内容不挂载,"完整回答默认不可见"的压缩原则由"关闭"承接。
 */
export function CoachReviewDrawer({
  open,
  rounds,
  currentLabel,
  guideHref,
  onClose,
}: {
  open: boolean;
  rounds: readonly ReviewRound[];
  /** 当前正在进行的幕/轮标签(过渡期可传 null,不标记) */
  currentLabel: string | null;
  guideHref: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* 打开时焦点落进面板;关闭由父层卸载,父层负责把焦点还给触发器 */
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  /* 焦点陷阱 + Esc 关闭:Tab 循环留在面板内 */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return (
    <div className="coach-review-layer" data-coach-review-layer>
      <button
        type="button"
        className={`coach-review-backdrop ${styles.backdrop}`}
        aria-label="关闭回看"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={coachProgressCopy.reviewTitle}
        className={`coach-review-panel ${styles.panel}`}
        data-coach-review
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="coach-review-head">
          <p className="coach-review-title">{coachProgressCopy.reviewTitle}</p>
          <button
            type="button"
            className={`coach-review-close ${styles.closeBtn}`}
            aria-label="关闭回看"
            onClick={onClose}
          >
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {rounds.length === 0 ? (
          <p className="coach-review-empty">{coachProgressCopy.reviewEmpty}</p>
        ) : (
          <ol className={`coach-review-list ${styles.reviewList}`}>
            {rounds.map((round, index) => {
              const actNumber = rounds
                .slice(0, index)
                .filter((item) => item.kind === "act").length;
              const deepeningNumber = rounds
                .slice(0, index)
                .filter((item) => item.kind === "deepening").length;
              return (
                <li
                  key={`${round.kind}-${index}`}
                  className={`coach-review-item ${styles.reviewItem}`}
                  data-coach-review-item
                >
                  <p className="coach-review-item-label">
                    {round.kind === "act"
                      ? `第 ${actNumber + 1} 幕 · ${round.label}`
                      : `深化 ${deepeningNumber + 1} · ${round.label}`}
                  </p>
                  <p className="coach-review-item-q">问:{round.question}</p>
                  <p className="coach-review-item-a">答:{round.answer}</p>
                  {/* 打磨轮⑦(§32 I1):过渡拍实际端上过的判断/风险留在历史里;
                      首轮无过渡拍,不渲染 */}
                  {round.judgment && round.risk && (
                    <div className="coach-review-item-jr" data-coach-review-jr>
                      <p className="coach-review-item-j">当时的判断:{round.judgment}</p>
                      <p className="coach-review-item-r">当时的风险:{round.risk}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {currentLabel && (
          <p className={`coach-review-current ${styles.currentChip}`} data-coach-review-current-label>
            当前:{currentLabel}
          </p>
        )}

        <div className="coach-review-foot">
          <Link href={guideHref} className="coach-review-guide hub-quiet-link">
            ← {coachProgressCopy.reviewGuideHint}
          </Link>
        </div>
      </div>
    </div>
  );
}

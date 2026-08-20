"use client";

/* 组织者后台共享:操作确认弹窗。
   取代原生 confirm()/prompt()——危险操作必须有清晰、可撤销语境的确认反馈。
   交互壳用 fx.tsx 的 Modal(Esc 关闭、焦点进入面板、关闭归还焦点)。 */

import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/fx";

export function ConfirmModal({
  open,
  title,
  desc,
  confirmLabel = "确认",
  cancelLabel = "取消",
  busy = false,
  danger = false,
  error = "",
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  desc?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  /** 危险操作:确认按钮用 danger 红 */
  danger?: boolean;
  error?: string;
  /** 附加禁用条件(如必填项未填) */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={title}>
      {desc && <p className="text-[13px] leading-6 text-ink-600">{desc}</p>}
      {children}
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs leading-4 text-red-600">
          <svg className="mt-0.5 h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1.5A6.5 6.5 0 1 0 14.5 8 6.5 6.5 0 0 0 8 1.5ZM8 4.6a.7.7 0 0 1 .7.7v3a.7.7 0 0 1-1.4 0v-3a.7.7 0 0 1 .7-.7Zm0 6.4a.85.85 0 1 1 0 1.7.85.85 0 0 1 0-1.7Z" />
          </svg>
          {error}
        </p>
      )}
      <div className="mt-5 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? "danger" : "primary"} size="sm" loading={busy} disabled={confirmDisabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Textarea } from "@/components/ui";
import { Modal } from "@/components/fx";
import { Send } from "lucide-react";

export function NudgeButton({ projectId, title, nextHint }: { projectId: string; title: string; nextHint: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const defaultMessage = `最新进展已同步,最小下一步:${nextHint}`;

  async function send() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/organizer/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, message: custom.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "发送失败");
      return;
    }
    setOpen(false);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700" role="status">
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="8" cy="8" r="6.4" />
          <path d="m5.4 8.2 1.8 1.8 3.4-4" />
        </svg>
        已提醒
      </span>
    );
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => { setError(""); setOpen(true); }}>
        温和提醒
      </Button>
      <Modal open={open} onClose={busy ? undefined : () => setOpen(false)} title={`温和提醒「${title}」`}>
        <p className="text-[13px] leading-6 text-ink-600">
          提醒会以站内通知发给该队全员。留空时使用默认话术:
        </p>
        <blockquote className="mt-2 rounded-md border-l-2 border-brand-500/70 bg-brand-50/60 px-3 py-2 text-xs leading-5 text-ink-600">
          {defaultMessage}
        </blockquote>
        <div className="mt-3">
          <Textarea
            rows={3}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="自定义话术(可选,保持温和、无压力)"
            aria-label="自定义提醒话术"
          />
        </div>
        {error && (
          <p role="alert" className="mt-2 text-xs leading-4 text-red-600">{error}</p>
        )}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            取消
          </Button>
          <Button size="sm" loading={busy} onClick={send}>
            <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            发送提醒
          </Button>
        </div>
      </Modal>
    </>
  );
}

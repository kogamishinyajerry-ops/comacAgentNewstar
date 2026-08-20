"use client";

import { Check, X } from "lucide-react";
import { TRACKS } from "@/lib/constants";
import { cn } from "./ui";

export function TrackStep({
  track,
  readOnly,
  projectId,
  onSelect,
}: {
  track: string | null;
  readOnly: boolean;
  projectId: string;
  onSelect: (t: string) => void;
}) {
  async function select(key: string) {
    if (readOnly) return;
    onSelect(key);
    await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track: key }),
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="赛道选择">
        {TRACKS.map((t) => {
          const selected = track === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={readOnly}
              onClick={() => select(t.key)}
              className={cn(
                "rounded-xl border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-soft",
                selected
                  ? "border-brand-500 bg-brand-50/70 shadow-[0_1px_2px_rgba(28,25,23,0.05),0_8px_24px_-8px_rgba(185,74,38,0.25)] ring-1 ring-brand-500"
                  : "border-ink-900/10 bg-[#fffdf8] hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_8px_24px_-10px_rgba(28,25,23,0.18)] active:translate-y-0",
                readOnly && "cursor-default hover:translate-y-0"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[15px] font-bold text-ink-900">{t.name}</span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
                    selected ? "anim-pop-in border-brand-600 bg-brand-600 text-white" : "border-ink-900/20 text-transparent"
                  )}
                  aria-hidden
                >
                  <Check size={11} strokeWidth={3.2} />
                </span>
              </div>
              <p className="mt-1.5 line-clamp-1 text-xs text-ink-500" title={t.description}>{t.description}</p>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-5 text-emerald-700" title={`适合:${t.suitable}`}>
                <Check size={13} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">{t.suitable}</span>
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-red-600/90" title={`不适合:${t.unsuitable}`}>
                <X size={13} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden />
                <span className="line-clamp-2">{t.unsuitable}</span>
              </p>
              <details className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                <summary className="cursor-pointer text-[11px] font-medium text-ink-400 transition-colors hover:text-brand-600">
                  微型示例
                </summary>
                <p className="mt-1.5 rounded-md bg-ink-50 p-2.5 text-xs leading-5 text-ink-600">{t.example}</p>
              </details>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-400">四个赛道固定,选择权在你,之后可改。</p>
    </div>
  );
}

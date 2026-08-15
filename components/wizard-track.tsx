"use client";

import { TRACKS } from "@/lib/constants";
import { Badge, cn } from "./ui";

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
      <div className="grid gap-3 md:grid-cols-2">
        {TRACKS.map((t) => (
          <button
            key={t.key}
            type="button"
            disabled={readOnly}
            onClick={() => select(t.key)}
            className={cn(
              "rounded-lg border p-4 text-left transition",
              track === t.key ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 bg-white hover:border-brand-400",
              readOnly && "cursor-default"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-800">{t.name}</span>
              {track === t.key && <Badge tone="indigo">已选</Badge>}
            </div>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500" title={t.description}>{t.description}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-emerald-700" title={`适合:${t.suitable}`}>✓ {t.suitable}</p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-red-600" title={`不适合:${t.unsuitable}`}>✗ {t.unsuitable}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-brand-600">微型示例</summary>
              <p className="mt-1 rounded bg-slate-50 p-2 text-xs leading-5 text-slate-600">{t.example}</p>
            </details>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-400">四个赛道固定,选择权在你,之后可改。</p>
    </div>
  );
}

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
            <p className="mt-1 text-xs text-slate-500">{t.description}</p>
            <p className="mt-2 text-xs text-emerald-700">✓ 适合:{t.suitable}</p>
            <p className="mt-1 text-xs text-red-600">✗ 不适合:{t.unsuitable}</p>
            <p className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">微型示例:{t.example}</p>
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400">赛道固定为四个,由组织者维护文案;Agent可给匹配建议,但选择权在你。</p>
    </div>
  );
}

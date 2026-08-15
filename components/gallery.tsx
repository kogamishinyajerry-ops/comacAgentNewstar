"use client";

// 插画图鉴:项目里程碑专属AI插画的收集册(8格,未解锁显示未知格)

import { useEffect, useState } from "react";
import { PROJECT_ART_SCENES } from "@/lib/art-scenes";
import { cn } from "./ui";

interface CollectedItem {
  scene: string;
  url: string;
  createdAt: string;
}

export function ArtGallery({ projectId, dense }: { projectId: string; dense?: boolean }) {
  const [items, setItems] = useState<CollectedItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/art/collection?projectId=${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setItems(j.collected))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [projectId]);

  const byScene = new Map((items ?? []).map((i) => [i.scene, i]));
  const collected = items?.length ?? 0;

  if (dense) {
    return (
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            插画图鉴 {items ? `${collected}/${PROJECT_ART_SCENES.length}` : "…"}
          </p>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {PROJECT_ART_SCENES.map((s) => {
            const got = byScene.get(s.scene);
            return (
              <div
                key={s.scene}
                title={got ? `${s.label} · 已收集` : `${s.label} · 未解锁`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md ring-1 ring-inset",
                  got ? "ring-amber-200" : "bg-slate-100/70 ring-slate-200"
                )}
              >
                {got ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={got.url} alt={s.label} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs opacity-40">?</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {PROJECT_ART_SCENES.map((s) => {
        const got = byScene.get(s.scene);
        return (
          <div
            key={s.scene}
            className={cn(
              "overflow-hidden rounded-xl ring-1 transition-all",
              got ? "surface-card surface-card-hover" : "border border-dashed border-slate-300 bg-slate-50/50"
            )}
          >
            <div className="relative aspect-square w-full bg-gradient-to-br from-slate-100 to-slate-50">
              {got ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={got.url} alt={s.label} className="anim-blur-reveal h-full w-full object-cover" />
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-400/90 px-1.5 py-px text-[9px] font-bold text-white">
                    已收集
                  </span>
                </>
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
                  <span className="text-2xl opacity-60 grayscale">{s.icon}</span>
                  <span className="text-[10px]">未解锁</span>
                </span>
              )}
            </div>
            <p className="px-2 py-1.5 text-center text-[10px] font-medium leading-3 text-slate-500">
              {s.icon} {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

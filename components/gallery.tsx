"use client";

// 插画图鉴:项目里程碑专属AI插画的收集册(8格,未解锁显示未知格)

import { useEffect, useState } from "react";
import { CircleHelp } from "lucide-react";
import { PROJECT_ART_SCENES } from "@/lib/art-scenes";
import { cn } from "./ui";

interface CollectedItem {
  scene: string;
  url: string;
  createdAt: string;
}

/** 未解锁格的诚实解锁条件(场景契约见 lib/art-scenes) */
function unlockHint(scene: string): string {
  if (scene.startsWith("step-")) return `完成第 ${scene.slice(5)} 步解锁`;
  if (scene === "submit") return "提交作品后解锁";
  return "达成对应成就后解锁";
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
        <div className="mb-1.5 flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
            插画图鉴{" "}
            {items ? (
              <>
                <span className="tnum text-ink-700">{collected}</span>
                <span className="tnum text-ink-400">/{PROJECT_ART_SCENES.length}</span>
              </>
            ) : (
              <span className="text-ink-400">…</span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {PROJECT_ART_SCENES.map((s) => {
            const got = byScene.get(s.scene);
            if (!items) {
              return <div key={s.scene} aria-hidden className="skeleton aspect-square rounded-md" />;
            }
            return (
              <div
                key={s.scene}
                title={got ? `${s.label} · 已收集` : `${s.label} · ${unlockHint(s.scene)}`}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-md ring-1 ring-inset transition-[box-shadow] duration-150",
                  got
                    ? "ring-amber-300/80 shadow-[0_1px_2px_rgba(28,25,23,0.08)]"
                    : "bg-ink-50/70 ring-ink-900/10"
                )}
              >
                {got ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={got.url} alt={s.label} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-ink-300">
                    <CircleHelp className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                  </span>
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
            title={got ? undefined : `${s.label} · ${unlockHint(s.scene)}`}
            className={cn(
              "overflow-hidden rounded-xl ring-1 transition-all",
              got ? "surface-card surface-card-hover" : "border border-dashed border-ink-900/15 bg-ink-50/30"
            )}
          >
            <div className="relative aspect-square w-full bg-gradient-to-br from-ink-50 to-[#fffdf8]">
              {!items ? (
                <div aria-hidden className="skeleton h-full w-full rounded-none" />
              ) : got ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={got.url} alt={s.label} className="anim-blur-reveal h-full w-full object-cover" />
                  <span className="absolute right-1.5 top-1.5 rounded-full bg-amber-100/95 px-1.5 py-px text-[9px] font-bold text-amber-800 ring-1 ring-inset ring-amber-300/70">
                    已收集
                  </span>
                </>
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-ink-300">
                  <span className="text-xl opacity-40 grayscale">{s.icon}</span>
                  <span className="text-center text-[10px] font-medium leading-4 tracking-wide text-ink-400">
                    {unlockHint(s.scene)}
                  </span>
                </span>
              )}
            </div>
            <p className="px-2 py-1.5 text-center text-[10px] font-medium leading-3 text-ink-500">
              {s.icon} {s.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

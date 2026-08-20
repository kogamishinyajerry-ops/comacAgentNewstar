"use client";

// 每日灵感卡:MiniMax 按日即兴创作的全站共用插画 + 轮换语录

import { useEffect, useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { DAILY_QUOTES, dailyScene } from "@/lib/art-scenes";

export function DailyInspiration() {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/art/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene: dailyScene() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.url) setUrl(j.url);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const quote = DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];

  return (
    <div className="surface-card relative overflow-hidden">
      <div className="p-2.5 pb-0">
        <div className="relative h-24 w-full overflow-hidden rounded-lg bg-gradient-to-br from-brand-50 via-[#fffdf8] to-amber-50 ring-1 ring-inset ring-ink-900/10">
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="今日灵感插画" className="anim-blur-reveal h-full w-full object-cover" />
              <Sparkles className="anim-sparkle absolute right-2.5 top-2.5 h-4 w-4 text-amber-300 drop-shadow-[0_1px_2px_rgba(28,25,23,0.35)]" aria-hidden />
            </>
          ) : failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-ink-300">
              <Lightbulb className="h-6 w-6" strokeWidth={1.5} aria-hidden />
              <span className="text-[10px] font-medium tracking-wide text-ink-400">今日插画暂缺,灵感照常</span>
            </div>
          ) : (
            <div aria-hidden className="skeleton h-full w-full rounded-none" />
          )}
          <span className="absolute bottom-2 left-2.5 rounded-full bg-[#fffdf8]/85 px-2 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-inset ring-ink-900/10 backdrop-blur">
            今日灵感 · MiniMax 即兴创作
          </span>
        </div>
      </div>
      <p className="text-balance px-4 py-3 font-display text-[13.5px] font-medium leading-6 tracking-[0.01em] text-ink-800">「{quote}」</p>
    </div>
  );
}

"use client";

// 每日灵感卡:MiniMax 按日即兴创作的全站共用插画 + 轮换语录

import { useEffect, useState } from "react";
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
      <div className="relative h-32 w-full bg-gradient-to-br from-brand-100 via-white to-amber-50">
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="今日灵感插画" className="anim-blur-reveal h-full w-full object-cover" />
            <span className="anim-sparkle absolute right-2 top-2 text-base">✨</span>
          </>
        ) : failed ? (
          <div className="flex h-full items-center justify-center text-2xl opacity-50">💡</div>
        ) : (
          <div className="anim-shimmer h-full w-full" />
        )}
        <span className="absolute bottom-2 left-3 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-slate-600 backdrop-blur">
          今日灵感 · MiniMax 即兴创作
        </span>
      </div>
      <p className="text-balance px-4 py-3 text-[13px] font-medium leading-6 text-slate-700">「{quote}」</p>
    </div>
  );
}

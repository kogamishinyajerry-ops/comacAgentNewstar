"use client";

import { useEffect } from "react";
import type { CoachVisualState } from "@/lib/hub/coach-machine";
import { COACH_STATE_ART } from "@/components/hub/coach-orb";

/** 首图(idle)由 next/image priority preload;其余四张在首屏空闲时预取,避免幕间切换按需拉大图。 */
const PREFETCH_STATES: readonly CoachVisualState[] = ["listening", "challenging", "condensing", "confirmed"];

export function CoachArtPrefetch() {
  useEffect(() => {
    let cancelled = false;
    const keep: HTMLImageElement[] = [];
    const prefetchAll = () => {
      if (cancelled) return;
      // 同文档 <link rel="prefetch"> 的响应不被后续 <img> 消费(实测会整图重下),
      // 用 Image() 走图片内存缓存,幕间切换即零网络命中。
      for (const state of PREFETCH_STATES) {
        const img = new Image();
        img.decoding = "async";
        img.src = COACH_STATE_ART[state];
        keep.push(img);
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 3000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id);
      };
    }
    const timer = window.setTimeout(prefetchAll, 2000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}

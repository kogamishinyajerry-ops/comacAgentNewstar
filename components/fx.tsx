"use client";

/* 仪式感特效层:彩带(canvas-confetti,社区标准,原生reduced-motion支持)、Toast栈、数字滚动、庆典遮罩。 */

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { cn } from "./ui";

/* ---------------- 彩带(canvas-confetti) ---------------- */

const PALETTE = ["#4f46e5", "#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

let confettiInstance: confetti.CreateTypes | null = null;

function engine(): confetti.CreateTypes | typeof confetti {
  if (confettiInstance) return confettiInstance;
  // 独立canvas实例,禁用reduced-motion用户的彩带
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  confettiInstance = confetti.create(canvas, {
    resize: true,
    useWorker: true,
    disableForReducedMotion: true,
  });
  return confettiInstance;
}

export function fireConfetti(opts: { origin?: { x: number; y: number }; count?: number; spread?: number } = {}) {
  if (typeof window === "undefined") return;
  const { x = 0.5, y = 0.35 } = opts.origin ?? {};
  engine()({
    particleCount: opts.count ?? 90,
    spread: (opts.spread ?? 7) * 12,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: PALETTE,
    ticks: 220,
    scalar: 0.95,
    gravity: 1.1,
    shapes: ["square", "circle"],
    zIndex: 9999,
  });
}

/** 从某个元素位置向上喷发(用于按钮处的小庆祝) */
export function burstFromElement(el: Element | null, count = 45) {
  if (!el || typeof window === "undefined") return;
  const rect = el.getBoundingClientRect();
  fireConfetti({ origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, count, spread: 4.5 });
}

/* ---------------- Toast ---------------- */

export interface ToastPayload {
  title: string;
  desc?: string;
  icon?: string;
  tone?: "achievement" | "success" | "info" | "error";
  durationMs?: number;
}

const TOAST_EVENT = "ynav-toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
}

interface ToastItem extends ToastPayload { id: number; }
let toastSeq = 1;

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const detail = (e as CustomEvent<ToastPayload>).detail;
      const item: ToastItem = { id: toastSeq++, durationMs: 4200, ...detail };
      setItems((prev) => [...prev.slice(-3), item]);
      setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== item.id)), item.durationMs);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const toneCls = {
    achievement: "border-amber-300/80 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-900",
    success: "border-emerald-200/80 bg-white text-emerald-900",
    info: "border-slate-200 bg-white text-slate-800",
    error: "border-red-200/80 bg-red-50 text-red-800",
  };

  return (
    <div className="no-print pointer-events-none fixed right-4 top-16 z-[10000] flex w-[340px] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            "anim-slide-in-right pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur",
            toneCls[t.tone ?? "info"]
          )}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg", t.tone === "achievement" ? "bg-amber-100 anim-pop-in" : "bg-slate-100")}>
            {t.icon ?? (t.tone === "achievement" ? "🏅" : t.tone === "error" ? "⚠️" : "✨")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-5">{t.title}</p>
            {t.desc && <p className="mt-0.5 text-xs leading-4 opacity-80">{t.desc}</p>}
          </div>
          <button
            className="shrink-0 rounded p-0.5 text-xs opacity-40 hover:opacity-80"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 数字滚动 ---------------- */

export function CountUp({ value, durationMs = 800, className }: { value: number; durationMs?: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return <span className={cn("tnum", className)}>{display}</span>;
}

/* ---------------- 庆典遮罩(提交成功等高光时刻) ---------------- */

export function CeremonyOverlay({
  open,
  emoji,
  title,
  desc,
  children,
  onClose,
}: {
  open: boolean;
  emoji: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  useEffect(() => {
    if (open) {
      fireConfetti({ count: 160, spread: 9 });
      const t2 = setTimeout(() => fireConfetti({ count: 90, origin: { x: window.innerWidth * 0.3, y: window.innerHeight * 0.3 } }), 350);
      const t3 = setTimeout(() => fireConfetti({ count: 90, origin: { x: window.innerWidth * 0.7, y: window.innerHeight * 0.3 } }), 600);
      return () => { clearTimeout(t2); clearTimeout(t3); };
    }
  }, [open]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-pop-in relative mx-4 w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="anim-float mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-amber-50 text-5xl ring-1 ring-amber-200">
          {emoji}
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {desc && <p className="mt-2 text-[13px] leading-6 text-slate-500">{desc}</p>}
        {children}
        {onClose && (
          <button className="mt-6 inline-flex h-10 items-center rounded-md bg-brand-600 px-6 text-sm font-medium text-white hover:bg-brand-700" onClick={onClose}>
            太好了,继续
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- 成就解锁庆祝 ---------------- */

export function celebrateAchievement(a: { name: string; desc: string; icon: string; rarity: string }) {
  showToast({
    tone: "achievement",
    icon: a.icon,
    title: `成就解锁 · ${a.name}`,
    desc: a.rarity === "epic" ? `【史诗】${a.desc}` : a.desc,
    durationMs: 5200,
  });
  fireConfetti({ count: 70, origin: { x: window.innerWidth - 180, y: 120 }, spread: 5 });
}

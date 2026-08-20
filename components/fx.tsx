"use client";

/* 仪式感特效层:彩带(canvas-confetti,社区标准,原生reduced-motion支持)、Toast栈、数字滚动、庆典遮罩。
   v2(2026-08-20 Act 5)新增:Reveal 滚动显现、Magnetic 磁吸、Lift 微浮起、
   SuccessMark 盖章勾选、Modal/Drawer 交互壳——全部 reduced-motion 感知。 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { cn, ModalShell, DrawerShell } from "./ui";

/** 当前是否偏好减弱动态(每次调用读取,响应系统设置切换) */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* ---------------- 彩带(canvas-confetti) ---------------- */

const PALETTE = ["#b94a26", "#d68f70", "#e0a458", "#1c1917", "#4a7c59", "#c9a227", "#7c2f18"];

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

/** 两侧礼炮(canvas-confetti 多段连发,用于史诗级时刻) */
export function sideCannons(durationMs = 1600) {
  if (typeof window === "undefined") return;
  const end = Date.now() + durationMs;
  const fire = () => {
    engine()({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: PALETTE, zIndex: 9999 });
    engine()({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: PALETTE, zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(fire);
  };
  fire();
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

  /* 默认图标:纯 SVG 绘制,不用 emoji 当图标(调用方显式传入的 icon 仍原样渲染) */
  const toneIcon: Record<NonNullable<ToastPayload["tone"]>, ReactNode> = {
    achievement: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="6" r="3.4" />
        <path d="m5.6 8.6-1.1 5 3.5-1.8 3.5 1.8-1.1-5" strokeLinejoin="round" />
      </svg>
    ),
    success: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="8" r="6" />
        <path d="m5.4 8.2 1.8 1.8 3.4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 7.4v3.4M8 4.9v.2" strokeLinecap="round" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 4.9v3.8M8 10.9v.2" strokeLinecap="round" />
      </svg>
    ),
  };

  return (
    <div className="no-print pointer-events-none fixed right-4 top-16 z-[10000] flex w-[340px] flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cn(
            "anim-slide-in-right pointer-events-auto flex items-start gap-3 rounded-xl border p-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)] backdrop-blur",
            toneCls[t.tone ?? "info"]
          )}
        >
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", t.tone === "achievement" ? "bg-amber-100 anim-pop-in" : "bg-ink-100")}>
            {t.icon ?? toneIcon[t.tone ?? "info"]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-5">{t.title}</p>
            {t.desc && <p className="mt-0.5 text-xs leading-4 opacity-80">{t.desc}</p>}
          </div>
          <button
            className="shrink-0 rounded p-1 opacity-40 transition-opacity hover:opacity-80"
            onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
            aria-label="关闭"
          >
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="m2.5 2.5 7 7m0-7-7 7" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------- 数字滚动(reduced-motion 下直接落定) ---------------- */

export function CountUp({ value, durationMs = 800, className }: { value: number; durationMs?: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to || prefersReducedMotion()) {
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

export function celebrateAchievement(a: { name: string; desc: string; icon: string; rarity: string }, projectId?: string) {
  if (a.rarity === "epic" && projectId) {
    // 史诗成就:全屏仪式(金光+旋入徽章+双侧礼炮+专属插画)
    window.dispatchEvent(new CustomEvent("ynav-epic", { detail: { achievement: a, projectId } }));
    return;
  }
  showToast({
    tone: "achievement",
    icon: a.icon,
    title: `成就解锁 · ${a.name}`,
    desc: a.rarity === "epic" ? `【史诗】${a.desc}` : a.desc,
    durationMs: 5200,
  });
  fireConfetti({ count: 70, origin: { x: window.innerWidth - 180, y: 120 }, spread: 5 });
}

/* ---------------- 史诗成就全屏仪式 ---------------- */

const EPIC_EVENT = "ynav-epic";

interface EpicPayload {
  achievement: { name: string; desc: string; icon: string };
  projectId: string;
}

function EpicCeremony({ payload, onClose }: { payload: EpicPayload; onClose: () => void }) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    sideCannons(1800);
    fireConfetti({ count: 120, spread: 10 });
    fetchArt({ projectId: payload.projectId, scene: `ach-${achSceneKey(payload.achievement.name)}` })
      .then((r) => r && setArt(r.url))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="no-print fixed inset-0 z-[10003] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div
        className="anim-pop-in relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 金色旋转光芒 */}
        <div
          className="anim-gradient-pan pointer-events-none absolute -inset-24 opacity-30"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.55) 30deg, transparent 60deg, transparent 120deg, rgba(251,191,36,0.4) 150deg, transparent 180deg, transparent 240deg, rgba(251,191,36,0.5) 290deg, transparent 320deg)",
          }}
        />
        <div className="relative">
          <div className="anim-float mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-200 text-5xl ring-2 ring-amber-300 shadow-[0_8px_30px_rgba(251,191,36,0.45)]">
            {payload.achievement.icon}
          </div>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-600">Epic Achievement</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{payload.achievement.name}</h2>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-6 text-slate-500">{payload.achievement.desc}</p>
          {art && (
            <div className="relative mx-auto mt-4 aspect-video w-56 overflow-hidden rounded-xl ring-1 ring-amber-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art} alt="史诗成就插画" className="anim-blur-reveal h-full w-full object-cover" />
              <span className="anim-sparkle absolute right-2 top-2 text-lg">✨</span>
            </div>
          )}
          <button className="mt-6 inline-flex h-10 items-center rounded-md bg-gradient-to-r from-amber-500 to-orange-500 px-6 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(245,158,11,0.4)] hover:brightness-110" onClick={onClose}>
            领取荣耀
          </button>
        </div>
      </div>
    </div>
  );
}

/** 成就名→图鉴场景key(与lib/art-scenes对齐) */
function achSceneKey(name: string): string {
  const map: Record<string, string> = {
    闭环掌控者: "loop-master",
    如实以告: "failure-honest",
    解法成立: "submitted",
  };
  for (const [k, v] of Object.entries(map)) if (name.includes(k)) return v;
  return "other";
}

/** 史诗仪式宿主(随ToastHost全局挂载) */
export function EpicHost() {
  const [payload, setPayload] = useState<EpicPayload | null>(null);
  useEffect(() => {
    const onEpic = (e: Event) => setPayload((e as CustomEvent<EpicPayload>).detail);
    window.addEventListener(EPIC_EVENT, onEpic);
    return () => window.removeEventListener(EPIC_EVENT, onEpic);
  }, []);
  if (!payload) return null;
  return <EpicCeremony payload={payload} onClose={() => setPayload(null)} />;
}

/* ---------------- XP 浮动数字 ---------------- */

export function XpFloat({ gain, onDone }: { gain: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1300);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <span className="anim-slide-in-right pointer-events-none absolute -top-5 right-0 select-none rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-[0_2px_10px_rgba(16,185,129,0.5)]">
      +{gain}%
    </span>
  );
}

/* ---------------- 里程碑插画盲盒(MiniMax生图) ---------------- */

const ART_WAIT_PHASES = [
  "🎨 正在召唤专属插画师…",
  "🎲 从你的项目里抽取灵感…",
  "✨ 构图中,每一张都独一无二…",
  "🖼️ 即将揭晓…",
];

export interface ArtRequest {
  projectId: string;
  scene: string;
  title?: string;
  track?: string | null;
  hint?: string;
}

/** 拉取插画(带12h服务端缓存),返回可直接使用的url */
export async function fetchArt(req: ArtRequest): Promise<{ url: string; cached: boolean } | null> {
  try {
    const res = await fetch("/api/art/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { url: string; cached: boolean };
    return { url: json.url, cached: json.cached };
  } catch {
    return null;
  }
}

/** 盲盒揭示遮罩:加载微光轮播 → 模糊揭晓 + 彩带 + 星光 */
export function ArtRevealModal({
  open,
  onClose,
  request,
  caption,
}: {
  open: boolean;
  onClose: () => void;
  request: ArtRequest | null;
  caption?: string;
}) {
  const [art, setArt] = useState<{ url: string; cached: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!open || !request) return;
    setArt(null);
    setFailed(false);
    setPhase(0);
    const iv = setInterval(() => setPhase((p) => (p + 1) % ART_WAIT_PHASES.length), 2200);
    let alive = true;
    fetchArt(request).then((r) => {
      if (!alive) return;
      if (r) {
        setArt(r);
        setTimeout(() => fireConfetti({ count: 110, spread: 8 }), 350);
      } else setFailed(true);
    });
    return () => {
      alive = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- request按projectId+scene语义依赖,对象身份每次渲染都变
  }, [open, request?.projectId, request?.scene]);

  if (!open || !request) return null;

  return (
    <div className="no-print fixed inset-0 z-[10002] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="anim-pop-in relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-brand-50 via-white to-amber-50">
          {art ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art.url} alt="AI为你的里程碑生成的专属插画" className="anim-blur-reveal h-full w-full object-cover" />
              <span className="anim-sparkle absolute left-5 top-5 text-2xl">✨</span>
              <span className="anim-sparkle absolute right-6 top-10 text-xl" style={{ animationDelay: "0.5s" }}>✨</span>
              <span className="anim-sparkle absolute bottom-6 left-10 text-lg" style={{ animationDelay: "0.9s" }}>✨</span>
            </>
          ) : failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
              <span className="text-4xl">🎨</span>
              <p className="text-sm">插画师暂时离席,不影响你的进度</p>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <div className="anim-float text-5xl">🎁</div>
              <div className="anim-shimmer h-2 w-40 rounded-full" />
              <p className="anim-pulse text-[13px] font-medium text-brand-700">{ART_WAIT_PHASES[phase]}</p>
            </div>
          )}
          <span className="absolute right-3 top-3 rounded-full bg-slate-900/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
            {art?.cached ? "专属回忆" : "全球唯一 · 为你生成"}
          </span>
        </div>
        <div className="p-4 text-center">
          <p className="text-sm font-semibold text-slate-900">{caption ?? "这份风景,只属于此刻的你"}</p>
          <p className="mt-1 text-[11px] leading-4 text-slate-400">由 MiniMax 生图模型根据你的项目内容即兴创作</p>
          <div className="mt-3 flex justify-center gap-2">
            {art && (
              <a
                href={art.url}
                download
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
              >
                保存这张插画
              </a>
            )}
            <button className="inline-flex h-9 items-center rounded-md bg-brand-600 px-5 text-[13px] font-medium text-white hover:bg-brand-700" onClick={onClose}>
              继续
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 嵌入式插画槽(用于提交庆典内):自动拉取并揭晓 */
export function ArtSlot({ request, className }: { request: ArtRequest; className?: string }) {
  const [art, setArt] = useState<{ url: string; cached: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    fetchArt(request).then((r) => alive && r && setArt(r));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 同上,按projectId+scene语义依赖
  }, [request.projectId, request.scene]);
  return (
    <div className={cn("relative mx-auto aspect-square w-40 overflow-hidden rounded-xl bg-gradient-to-br from-brand-50 to-amber-50 ring-1 ring-amber-200/60", className)}>
      {art ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={art.url} alt="里程碑插画" className="anim-blur-reveal h-full w-full object-cover" />
          <span className="anim-sparkle absolute right-2 top-2 text-lg">✨</span>
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-1.5">
          <span className="anim-float text-3xl">🎁</span>
          <div className="anim-shimmer h-1.5 w-24 rounded-full" />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   设计系统 v2 动效原语(2026-08-20 Act 5)
   约定:所有位移/进场仅在 prefers-reduced-motion: no-preference 时生效;
   SSR 与无 JS 场景内容始终可见;焦点绝不落入尚未显现的内容。
   ============================================================ */

/* ---------------- 滚动显现(IntersectionObserver) ---------------- */

export function Reveal({
  children,
  className,
  delayMs = 0,
  threshold = 0.12,
}: {
  children: ReactNode;
  className?: string;
  /** 错峰延迟(ms),仅 0–200 之间的小值;同屏最多 3 拍 */
  delayMs?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    // reduced-motion / 无 IO:不加 fx-reveal 类,内容直接可见
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    // 挂载时已在视口内的元素立即显现,避免首屏闪烁
    return () => io.disconnect();
  }, [threshold]);
  return (
    <div
      ref={ref}
      className={cn(armed && "fx-reveal", inView && "is-in", className)}
      style={delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/* ---------------- hover 磁吸(鼠标微调位移,触屏/减弱动态自动停用) ---------------- */

export function Magnetic({
  children,
  className,
  maxPx = 4,
}: {
  children: ReactNode;
  className?: string;
  /** 最大吸附位移(px),克制区间 2–6 */
  maxPx?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    const dx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const dy = ((e.clientY - r.top) / r.height - 0.5) * 2;
    el.style.transform = `translate(${(dx * maxPx).toFixed(1)}px, ${(dy * maxPx).toFixed(1)}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={cn("fx-magnet inline-block", className)}>
      {children}
    </div>
  );
}

/* ---------------- 微浮起(纯 CSS hover,-2px + 层叠阴影) ---------------- */

export function Lift({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("fx-lift", className)}>{children}</div>;
}

/* ---------------- 成功仪式:盖章 + 勾选绘制(精致版) ----------------
   animate-scale-in / animate-check-draw 来自 tailwind.config 的共享动画,
   两个路由组都可用;reduced-motion 下直接呈现完成态。 */

export function SuccessMark({
  size = 56,
  label,
  className,
}: {
  size?: number;
  /** 提供可读名时会作为 img 角色暴露;纯装饰则省略 */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="animate-scale-in absolute inset-0 rounded-full bg-emerald-50 ring-1 ring-emerald-200/80 shadow-[0_4px_14px_-4px_rgba(15,117,100,0.35)]" />
      <svg className="relative" width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="m5 12.5 4.5 4.5L19 7.5"
          stroke="#0f7564"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={24}
          className="animate-check-draw"
        />
      </svg>
    </span>
  );
}

/* ---------------- Modal / Drawer 交互壳(Esc 关闭 + 焦点管理) ----------------
   结构与外观复用 ui.tsx 的 ModalShell/DrawerShell;
   打开时焦点进入面板,关闭后归还触发元素。 */

function useDialogA11y(open: boolean, onClose: (() => void) | undefined, containerRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = containerRef.current?.querySelector<HTMLElement>('[role="dialog"]');
    if (panel) {
      panel.setAttribute("tabindex", "-1");
      panel.focus({ preventScroll: true });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus({ preventScroll: true });
    };
  }, [open, onClose, containerRef]);
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, containerRef);
  return (
    <div ref={containerRef} className="contents">
      <ModalShell open={open} onClose={onClose} title={title} className={cn("animate-scale-in", className)}>
        {children}
      </ModalShell>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  className,
  side = "right",
}: {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  side?: "left" | "right";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y(open, onClose, containerRef);
  return (
    <div ref={containerRef} className="contents">
      <DrawerShell open={open} onClose={onClose} title={title} side={side} className={cn("animate-fade-in", className)}>
        {children}
      </DrawerShell>
    </div>
  );
}

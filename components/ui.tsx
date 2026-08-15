import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import Link from "next/link";
import { STATUS_LABELS, type ProjectStatus } from "@/lib/constants";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Button ---------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type ButtonSize = "xs" | "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink-900 text-paper shadow-none hover:bg-ink-800 active:translate-y-px",
  secondary:
    "border border-ink-900/20 bg-transparent text-ink-800 hover:border-ink-900/45 hover:bg-ink-50 active:translate-y-px",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
  danger:
    "bg-red-700 text-paper hover:bg-red-800 active:translate-y-px",
  subtle: "bg-brand-50 text-brand-700 hover:bg-brand-100",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-6 gap-1 rounded px-2 text-xs",
  sm: "h-8 gap-1.5 rounded-md px-3 text-[13px]",
  md: "h-9 gap-1.5 rounded-md px-4 text-sm",
  lg: "h-11 gap-2 rounded-md px-5 text-[15px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
    >
      {children}
    </Link>
  );
}

/* ---------------- Card ---------------- */

export function Card({
  title,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("surface-card flex flex-col", className)}>
      {(title || actions) && (
        <header className="flex min-h-[46px] items-center justify-between gap-3 border-b border-ink-900/10 px-4 py-2.5">
          <h2 className="font-display text-[13px] font-bold tracking-wide text-ink-900">{title}</h2>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("flex-1 px-4 py-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ---------------- Badge ---------------- */

type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "indigo" | "slate";

const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
  slate: "bg-slate-50 text-slate-500 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200/70",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
  amber: "bg-amber-50 text-amber-700 ring-amber-200/70",
  red: "bg-red-50 text-red-700 ring-red-200/70",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200/70",
};

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium leading-4 ring-1 ring-inset",
        badgeTones[tone]
      )}
    >
      {children}
    </span>
  );
}

const statusTones: Record<ProjectStatus, BadgeTone> = {
  DRAFT: "slate",
  SUBMITTED: "blue",
  RETURNED: "amber",
  PRELIMINARY: "indigo",
  FINAL: "indigo",
  ARCHIVED: "gray",
};

const statusDots: Record<ProjectStatus, string> = {
  DRAFT: "bg-slate-400",
  SUBMITTED: "bg-blue-500",
  RETURNED: "bg-amber-500",
  PRELIMINARY: "bg-indigo-500",
  FINAL: "bg-indigo-500",
  ARCHIVED: "bg-slate-300",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as ProjectStatus) in STATUS_LABELS ? (status as ProjectStatus) : "DRAFT";
  return (
    <Badge tone={statusTones[s]}>
      <span className={cn("h-1.5 w-1.5 rounded-full", statusDots[s])} />
      {STATUS_LABELS[s]}
    </Badge>
  );
}

/* ---------------- 表单 ---------------- */

const inputBase =
  "w-full rounded-md border border-ink-900/20 bg-[#fffdf8] px-3 text-[13px] text-ink-900 transition-colors placeholder:text-ink-300 hover:border-ink-900/35 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-300";

export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: ReactNode;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 flex items-start gap-1 text-xs leading-4 text-slate-400">
          <svg className="mt-0.5 h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8 6.5 6.5 0 0 1 8 1.5ZM8 10.6a.85.85 0 1 0 0 1.7.85.85 0 0 0 0-1.7Zm.05-5.85c-.99 0-1.8.63-2.02 1.55a.55.55 0 0 0 1.07.25c.08-.34.42-.6.95-.6.55 0 .95.35.95.8 0 .36-.2.55-.68.9-.44.31-.98.72-.98 1.5v.1a.55.55 0 0 0 1.1 0c0-.28.14-.43.58-.75.47-.34 1.08-.79 1.08-1.75 0-1.13-.92-2-2.05-2Z" />
          </svg>
          {hint}
        </span>
      )}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, "h-9", className)} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "min-h-[84px] leading-relaxed", className)} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, "select-arrow h-9 cursor-pointer pr-8", className)} />;
}

/* ---------------- Alert ---------------- */

type AlertTone = "info" | "success" | "warn" | "error";

const alertConfig: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: {
    box: "border-blue-200/80 bg-blue-50/70 text-blue-900",
    icon: (
      <>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 7.2v4M8 4.8v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  success: {
    box: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
    icon: (
      <>
        <circle cx="8" cy="8" r="6.2" />
        <path d="m5.5 8.2 1.8 1.8 3.2-3.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  warn: {
    box: "border-amber-200/80 bg-amber-50/70 text-amber-900",
    icon: (
      <>
        <path d="M8 2.2 14.4 13.4H1.6L8 2.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
        <path d="M8 6.4v3M8 11v.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
  error: {
    box: "border-red-200/80 bg-red-50/70 text-red-900",
    icon: (
      <>
        <circle cx="8" cy="8" r="6.2" />
        <path d="M8 4.8v4M8 10.8v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
  },
};

export function Alert({ tone = "info", title, children }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode }) {
  const c = alertConfig[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px]", c.box)}>
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" aria-hidden>
        {c.icon}
      </svg>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

/* ---------------- 空状态 ---------------- */

export function EmptyState({
  title,
  desc,
  action,
  icon,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300/80 bg-slate-50/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200">
        {icon ?? (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3h9A1.5 1.5 0 0 1 16 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 4 15.5v-11Zm2 2.7c0 .3.22.5.5.5h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0-.5.5Zm.5 2.3h7a.5.5 0 0 0 0-1h-7a.5.5 0 0 0 0 1Zm0 2.5h4.5a.5.5 0 0 0 0-1H6.5a.5.5 0 0 0 0 1Z" />
          </svg>
        )}
      </div>
      <p className="text-[13px] font-medium text-slate-700">{title}</p>
      {desc && <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- 页头 / 统计卡 / 进度 ---------------- */

export function PageHeader({ title, desc, actions }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight text-ink-900">{title}</h1>
        {desc && <p className="mt-1 text-[13px] leading-5 text-ink-500">{desc}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  suffix,
  tone = "default",
  hint,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  tone?: "default" | "brand" | "danger" | "success";
  hint?: string;
}) {
  const valueTone = {
    default: "text-ink-900",
    brand: "text-brand-600",
    danger: "text-red-700",
    success: "text-emerald-700",
  }[tone];
  return (
    <div className="surface-card px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn("tnum mt-0.5 text-[22px] font-semibold leading-7 tracking-tight", valueTone)}>
        {value}
        {suffix && <span className="ml-0.5 text-xs font-normal text-slate-400">{suffix}</span>}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

export function ProgressBar({ pct, tone = "brand", height = "h-1.5" }: { pct: number; tone?: "brand" | "green" | "amber"; height?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const toneCls = tone === "green" ? "bg-emerald-500" : tone === "amber" ? "bg-amber-500" : "bg-brand-600";
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-slate-200/70", height)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", toneCls)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function ProgressRing({
  pct,
  size = 72,
  stroke = 6,
  label,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  label?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d68f70" />
            <stop offset="100%" stopColor="#a03e20" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        {label ?? <span className="tnum text-sm font-bold text-slate-800">{Math.round(clamped)}%</span>}
      </span>
    </div>
  );
}

/* ---------------- 表格 ---------------- */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className={cn("w-full min-w-[640px] border-collapse text-[13px]", className)}>{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "sticky top-0 z-[1] border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 backdrop-blur",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={cn("border-b border-slate-100 px-3 py-2.5 align-top text-slate-700", className)}>{children}</td>;
}

/* ---------------- 自动保存指示 ---------------- */

export function AutoSaveIndicator({ state, savedAt }: { state: "idle" | "saving" | "saved" | "error"; savedAt?: string }) {
  const map = {
    idle: { text: "自动保存已开启", dot: "bg-slate-300", cls: "text-slate-400" },
    saving: { text: "保存中…", dot: "bg-amber-400 animate-pulse", cls: "text-amber-600" },
    saved: { text: `已保存 ${savedAt ?? ""}`, dot: "bg-emerald-500", cls: "text-emerald-600" },
    error: { text: "保存失败,请检查网络", dot: "bg-red-500", cls: "text-red-600" },
  } as const;
  const m = map[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", m.cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.text}
    </span>
  );
}

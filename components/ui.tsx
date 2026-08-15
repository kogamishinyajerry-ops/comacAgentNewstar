import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import Link from "next/link";
import { STATUS_LABELS, type ProjectStatus } from "@/lib/constants";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:outline-brand-600",
  secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100",
  ghost: "text-brand-600 hover:bg-brand-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        buttonStyles[variant],
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
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md font-medium transition",
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm",
        buttonStyles[variant],
        className
      )}
    >
      {children}
    </Link>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          {actions}
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

type BadgeTone = "gray" | "blue" | "green" | "amber" | "red" | "indigo";

const badgeTones: Record<BadgeTone, string> = {
  gray: "bg-slate-100 text-slate-600",
  blue: "bg-blue-50 text-blue-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  indigo: "bg-indigo-50 text-indigo-700",
};

export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

const statusTones: Record<ProjectStatus, BadgeTone> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  RETURNED: "amber",
  PRELIMINARY: "indigo",
  FINAL: "indigo",
  ARCHIVED: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  const s = (status as ProjectStatus) in STATUS_LABELS ? (status as ProjectStatus) : "DRAFT";
  return <Badge tone={statusTones[s]}>{STATUS_LABELS[s]}</Badge>;
}

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
      <span className="mb-1 flex items-baseline gap-1 text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "min-h-[80px]", props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputBase, props.className)} />;
}

type AlertTone = "info" | "success" | "warn" | "error";

const alertTones: Record<AlertTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
};

export function Alert({ tone = "info", title, children }: { tone?: AlertTone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm", alertTones[tone])}>
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {desc && <p className="mt-1 text-xs text-slate-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function AutoSaveIndicator({ state, savedAt }: { state: "idle" | "saving" | "saved" | "error"; savedAt?: string }) {
  const map = {
    idle: { text: "自动保存已开启", cls: "text-slate-400" },
    saving: { text: "保存中…", cls: "text-amber-600" },
    saved: { text: `已保存 ${savedAt ?? ""}`, cls: "text-emerald-600" },
    error: { text: "保存失败,请检查网络", cls: "text-red-600" },
  } as const;
  const m = map[state];
  return <span className={cn("text-xs", m.cls)}>{m.text}</span>;
}

import { Download } from "lucide-react";

/* 组织者后台共享:数据导出入口。
   外观对齐 ui.tsx Button variant="secondary" size="sm",
   但保持原生 <a href="/api/..."> 语义(浏览器直接下载,不走 next/link 预取)。 */
const exportCls =
  "inline-flex h-8 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-ink-900/20 bg-[#fffdf8] px-3 text-[13px] font-medium text-ink-800 shadow-[0_1px_2px_rgba(28,25,23,0.05)] transition-[transform,box-shadow,background-color,border-color,color] duration-150 ease-soft hover:-translate-y-px hover:border-ink-900/45 hover:bg-ink-50 hover:shadow-[0_4px_14px_-4px_rgba(28,25,23,0.14)] active:translate-y-0 active:scale-[0.98] active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-paper";

export function ExportLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className={exportCls}>
      <Download className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      {label}
    </a>
  );
}

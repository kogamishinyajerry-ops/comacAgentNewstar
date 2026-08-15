import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";

export const metadata: Metadata = {
  title: "青年AI轻创导航站",
  description: "发现一个真问题,做一个可验证的解法。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Nav />
        <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-7xl px-4 py-6">{children}</main>
        <footer className="no-print border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
          青年AI轻创导航站 · 发现一个真问题,做一个可验证的解法。
        </footer>
      </body>
    </html>
  );
}

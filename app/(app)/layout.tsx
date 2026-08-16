import type { Metadata } from "next";
import "../globals.css";
import { Nav } from "@/components/nav";
import { ToastHost, EpicHost } from "@/components/fx";
import { DemoLauncher, DemoPlayer } from "@/components/demo-player";

export const metadata: Metadata = {
  title: "青年AI轻创导航站",
  description: "发现一个真问题,做一个可验证的解法。",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="no-print border-t border-slate-200/80 bg-white py-3.5">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-400">
          青年AI轻创导航站 · 发现一个真问题,做一个可验证的解法。
        </p>
      </footer>
      <ToastHost />
      <EpicHost />
      <DemoPlayer />
      <DemoLauncher />
    </div>
  );
}

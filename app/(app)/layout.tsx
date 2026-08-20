import type { Metadata } from "next";
import "../globals.css";
import { Nav } from "@/components/nav";
import { ToastHost, EpicHost } from "@/components/fx";
import { DemoLauncher, DemoPlayer } from "@/components/demo-player";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: site.title,
  description: site.description,
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="no-print border-t border-ink-900/10 py-5">
        <p className="mx-auto max-w-7xl px-4 text-center text-xs tracking-wide text-ink-500">
          {site.brand.shortName} · 从真实问题出发，用证据完成作品。
        </p>
      </footer>
      <ToastHost />
      <EpicHost />
      <DemoPlayer />
      <DemoLauncher />
    </div>
  );
}

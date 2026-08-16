"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { site } from "@/config/site";

/** 品牌标识:未获授权前只用文字 + 中性几何标记,不伪造官方 Logo(docs/product/03 §7) */
function BrandMark() {
  return (
    <Link href="/" className="hub-brand" aria-label={`${site.brand.name} 首页`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
        <circle cx="13" cy="13" r="11" fill="none" stroke="var(--accent-coach)" strokeWidth="1.6" />
        <circle cx="13" cy="13" r="5.5" fill="var(--accent-coach)" opacity="0.85" />
        <circle cx="13" cy="13" r="1.8" fill="#fff" />
      </svg>
      <span className="flex flex-col leading-tight">
        <span>{site.brand.shortName}</span>
        <span className="text-[10.5px] font-medium tracking-[0.08em] text-[var(--text-tertiary)]">
          {site.brand.tagline}
        </span>
      </span>
    </Link>
  );
}

export function HubHeader() {
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) burgerRef.current?.focus();
  }, []);

  /* Esc 关闭;焦点圈定在抽屉内;打开时锁定背景滚动 */
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const scope = drawerRef.current;
      if (!scope) return;
      const focusables = Array.from(
        scope.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  return (
    <header className="hub-header">
      <div className="hub-container hub-header-inner">
        <BrandMark />

        <nav className="ml-4 hidden items-center gap-7 md:flex" aria-label="主导航">
          {site.nav.map((item) => (
            <Link key={item.href} href={item.href} className="hub-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link
            href={site.primaryCta.href}
            className="hub-btn hub-btn--primary hidden !min-h-[40px] px-5 text-[14px] md:inline-flex"
          >
            {site.primaryCta.label}
          </Link>
          <button
            ref={burgerRef}
            type="button"
            className="hub-burger md:hidden"
            aria-expanded={open}
            aria-controls="hub-drawer"
            aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
            data-open={open}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      <div
        id="hub-drawer"
        ref={drawerRef}
        className="hub-drawer md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="站点导航"
        data-open={open}
      >
        <nav aria-label="移动端主导航" className="flex flex-col">
          {site.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hub-drawer-link"
              onClick={() => close(false)}
            >
              {item.label}
              <span aria-hidden className="text-[var(--text-tertiary)]">→</span>
            </Link>
          ))}
        </nav>
        <Link
          href={site.primaryCta.href}
          className="hub-btn hub-btn--primary mt-6 w-full"
          onClick={() => close(false)}
        >
          {site.primaryCta.label}
        </Link>
      </div>
    </header>
  );
}

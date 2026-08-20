"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { approvedActivityLogoPath } from "@/config/activity";
import { site } from "@/config/site";

/** 品牌标识:只有配置校验与精确白名单均通过时才显示获准 Logo。 */
function BrandMark() {
  return (
    <Link href="/" className="hub-brand" aria-label={`${site.brand.name} 首页`}>
      {approvedActivityLogoPath ? (
        <Image
          src={approvedActivityLogoPath}
          alt={`${site.brand.name} 标识`}
          className="hub-brand-logo"
          width={26}
          height={26}
          priority
        />
      ) : (
        <span className="hub-brand-rule" aria-hidden="true" />
      )}
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
  /* 两个 Coach 入口均不显示自指 CTA，避免整棵状态树重挂载并丢失进度。 */
  const pathname = usePathname();
  const onWorkbench = pathname === "/" || pathname === "/start";
  const [open, setOpen] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) burgerRef.current?.focus();
  }, []);

  /* Esc 关闭;焦点圈定在抽屉内;打开时锁定背景滚动。 */
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("[data-drawer-initial-focus]")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const scope = drawerRef.current;
      if (!scope) return;
      const focusables = Array.from(
        scope.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
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
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    /* 抽屉必须留在 header 之外:header 的 backdrop-filter 会成为
       fixed 后代的包含块,使抽屉的 inset 相对 header 解析而塌陷。 */
    <>
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
            {!onWorkbench && (
              <Link
                href={site.primaryCta.href}
                className="hub-btn hub-btn--primary hidden !min-h-[40px] px-5 text-[14px] md:inline-flex"
              >
                {site.primaryCta.label}
              </Link>
            )}
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
      </header>

      <div
        id="hub-drawer"
        ref={drawerRef}
        className="hub-drawer md:hidden"
        role="dialog"
        aria-modal={open}
        aria-hidden={!open}
        aria-label="站点导航"
        data-open={open}
      >
        <button
          type="button"
          className="hub-drawer-close"
          data-drawer-initial-focus
          onClick={() => close()}
        >
          关闭导航菜单
        </button>
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
        {!onWorkbench && (
          <Link
            href={site.primaryCta.href}
            className="hub-btn hub-btn--primary mt-6 w-full"
            onClick={() => close(false)}
          >
            {site.primaryCta.label}
          </Link>
        )}
      </div>
    </>
  );
}

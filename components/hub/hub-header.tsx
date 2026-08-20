"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { approvedActivityLogoPath } from "@/config/activity";
import { site } from "@/config/site";
import { Magnetic } from "@/components/fx";

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
  const [scrolled, setScrolled] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) burgerRef.current?.focus();
  }, []);

  /* 滚动态:离开页顶后顶导获得远处软阴影,内容从 hairline 下方"滑入"其下。 */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  /* §33 K1:工作台页是全幅 Agent 工作台,站点导航栏在此只增加使用与理解成本,
     直接不渲染(布局为 flex,主区自动占满);指南/角色等内容页保留站点 chrome */
  if (onWorkbench) return null;

  /* 当前位置指示:精确匹配首页,其余按前缀;同时服务桌面 nav 与移动抽屉。 */
  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    /* 抽屉必须留在 header 之外:header 的 backdrop-filter 会成为
       fixed 后代的包含块,使抽屉的 inset 相对 header 解析而塌陷。 */
    <>
      <header
        className="hub-header transition-[box-shadow] duration-300 ease-soft"
        data-scrolled={scrolled}
        style={{
          boxShadow: scrolled
            ? "0 1px 0 var(--hairline-strong), 0 18px 44px -28px rgba(23, 34, 56, 0.28)"
            : "0 1px 0 transparent",
        }}
      >
        <div className="hub-container hub-header-inner">
          <BrandMark />

          <nav className="ml-4 hidden items-center gap-7 md:flex" aria-label="主导航">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hub-nav-link"
                data-current={isCurrent(item.href)}
                aria-current={isCurrent(item.href) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!onWorkbench && (
              <Magnetic maxPx={3} className="hidden md:inline-block">
                <Link
                  href={site.primaryCta.href}
                  className="hub-btn hub-btn--primary !min-h-[40px] px-5 text-[14px]"
                >
                  {site.primaryCta.label}
                </Link>
              </Magnetic>
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
        <nav aria-label="移动端主导航" className="flex flex-col">
          {site.nav.map((item, i) => (
            <Link
              key={item.href}
              href={item.href}
              className={`hub-drawer-link transition-[opacity,transform] duration-300 ease-soft ${
                open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
              }`}
              style={{
                transitionDelay: open ? `${90 + i * 50}ms` : "0ms",
                color: isCurrent(item.href) ? "var(--accent-coach-strong)" : undefined,
              }}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              data-current={isCurrent(item.href)}
              /* 打开时初始焦点落在首个链接;关闭由 header 汉堡 X 承担,
                 Esc 关闭并把焦点归还汉堡(契约见 useEffect) */
              data-drawer-initial-focus={i === 0 ? true : undefined}
              onClick={() => close(false)}
            >
              <span className="flex items-baseline gap-4">
                <span
                  aria-hidden="true"
                  className="text-[12px] font-semibold tracking-[0.18em] text-[var(--text-tertiary)] tabular-nums"
                >
                  0{i + 1}
                </span>
                {item.label}
              </span>
              <ArrowRight
                size={18}
                strokeWidth={1.8}
                aria-hidden="true"
                className={
                  isCurrent(item.href)
                    ? "text-[var(--accent-coach)]"
                    : "text-[var(--text-tertiary)]"
                }
              />
            </Link>
          ))}
        </nav>
        {!onWorkbench && (
          <Link
            href={site.primaryCta.href}
            className={`hub-btn hub-btn--primary mt-8 w-full transition-[opacity,transform] duration-300 ease-soft ${
              open ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
            }`}
            style={{ transitionDelay: open ? `${90 + site.nav.length * 50}ms` : "0ms" }}
            onClick={() => close(false)}
          >
            {site.primaryCta.label}
          </Link>
        )}
      </div>
    </>
  );
}

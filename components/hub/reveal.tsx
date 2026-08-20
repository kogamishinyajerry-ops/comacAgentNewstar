"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
  type Ref,
} from "react";

/**
 * 滚动"端上来":进入视口时一次性显现。
 * - 初始隐藏仅在 JS 挂载后生效(data-js),无 JS / SSR 下内容直接可见;
 * - prefers-reduced-motion 下不隐藏、不平移(见 tokens.css);
 * - delayMs 用于同屏错峰(仅 0–200,同屏最多 3 拍),超界自动截断。
 */
export function Reveal({
  children,
  className = "",
  as = "div",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
  /** 错峰延迟(ms),仅 0–200 之间的小值 */
  delayMs?: number;
}) {
  const Tag = as as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [jsReady, setJsReady] = useState(false);
  const [isIn, setIsIn] = useState(false);
  const delay = Math.min(Math.max(delayMs, 0), 200);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setJsReady(true);
    if (typeof IntersectionObserver === "undefined") {
      setIsIn(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsIn(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as Ref<HTMLElement>}
      className={`reveal ${isIn ? "is-in" : ""} ${className}`}
      data-js={jsReady ? "true" : undefined}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

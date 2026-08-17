"use client";

import { useEffect, useRef, useState } from "react";
import { journeySteps } from "@/config/activity";
import { Reveal } from "./reveal";

/**
 * 模块 D“你会经历什么”:五段实践路径。
 * 桌面横向轨迹,移动端单焦点逐段;滚动只点亮当前阶段,不做粗重时间轴。
 */
export function JourneyTrack() {
  const [current, setCurrent] = useState(0);
  const ref = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const steps = Array.from(list.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        /* 视口中心带命中的最后一段成为当前段 */
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const idx = steps.indexOf(entry.target as HTMLElement);
            if (idx >= 0) setCurrent(idx);
          }
        }
      },
      { rootMargin: "-42% 0px -42% 0px", threshold: 0 }
    );
    steps.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="journey"
      className="hub-section atlas-section atlas-section--journey"
      aria-labelledby="journey-title"
      data-atlas-chapter="02"
    >
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">实践路径</p>
          <h2 id="journey-title" className="hub-title mt-4 max-w-[560px]">
            你会经历什么
          </h2>
          <p className="hub-body mt-4 max-w-[560px]">
            五段路径贯穿始终。它不是十步表单——每一段都是一次真问题的追问与回答,
            滚动到这里时,当前阶段会被点亮。
          </p>
        </Reveal>

        <ol
          ref={ref}
          className="motion-stagger mt-14 grid gap-8 md:grid-cols-5 md:gap-5"
          aria-label="五段实践路径"
        >
          {journeySteps.map((step, i) => {
            const isCurrent = i === current;
            return (
              <li
                key={step.key}
                className="journey-step"
                data-current={isCurrent ? "true" : "false"}
                aria-current={isCurrent ? "step" : undefined}
              >
                {/* 轨迹连线(桌面) */}
                <div className="relative mb-5 hidden md:block" aria-hidden="true">
                  <div
                    className="absolute left-0 right-0 top-1/2 h-px"
                    style={{
                      background: isCurrent ? "var(--accent-coach)" : "var(--border-subtle)",
                    }}
                  />
                  <div className="journey-dot relative bg-[var(--surface-canvas)]" />
                </div>

                <div className="flex items-center gap-3 md:hidden" aria-hidden="true">
                  <div className="journey-dot" />
                  <div className="h-px flex-1 bg-[var(--border-subtle)]" />
                  <span className="journey-index">{step.index}</span>
                </div>

                <p className="journey-index mt-0 hidden md:block">{step.index}</p>
                <p className="mt-2.5 text-[16.5px] font-bold text-[var(--text-primary)]">
                  {step.title}
                </p>
                <p className="hub-caption mt-2 !text-[13.5px]">{step.summary}</p>

                {/* 当前阶段展开细节(取到眼前);其余阶段收起,摘要仍在 */}
                <div
                  className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ gridTemplateRows: isCurrent ? "1fr" : "0fr" }}
                >
                  <div className="min-h-0">
                    <p className="hub-body mt-3 border-l-2 pl-3 !text-[13.5px]" style={{ borderColor: "var(--accent-coach)" }}>
                      {step.detail}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

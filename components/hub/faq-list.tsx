import { ChevronDown } from "lucide-react";
import { site } from "@/config/site";
import { Reveal } from "./reveal";

/**
 * 模块 I:FAQ。details/summary 实现,无 JS 也可展开阅读。
 * 编号 + 问题 + 答案三层排版;chevron 旋转即展开态的唯一动效。
 */
export function FaqList() {
  return (
    <section id="faq" className="hub-section atlas-appendix" aria-labelledby="faq-title">
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">常见问题</p>
          <h2 id="faq-title" className="hub-title mt-4 max-w-[560px]">先问过我们的问题</h2>
          <p className="hub-lead mt-5 max-w-[600px]">
            关于参与门槛、平台边界与 Coach 工作方式,最直接的五个回答。
          </p>
        </Reveal>

        <Reveal className="mt-12" delayMs={90}>
          <div className="border-t border-[var(--hairline-strong)]">
            {site.faq.map((item, i) => (
              <details key={item.q} className="faq-item group">
                <summary className="transition-colors duration-150 ease-soft hover:text-[var(--accent-coach-strong)]">
                  <span className="flex items-baseline gap-5">
                    <span
                      aria-hidden="true"
                      className="text-[12.5px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)] tabular-nums"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{item.q}</span>
                  </span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.8}
                    className="faq-chevron"
                    aria-hidden="true"
                    focusable="false"
                  />
                </summary>
                <div className="faq-answer sm:pl-[52px]">
                  <p className="hub-body">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

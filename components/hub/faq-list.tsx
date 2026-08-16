import { site } from "@/config/site";
import { Reveal } from "./reveal";

/**
 * 模块 I:FAQ。details/summary 实现,无 JS 也可展开阅读。
 */
export function FaqList() {
  return (
    <section id="faq" className="hub-section" aria-labelledby="faq-title">
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">常见问题</p>
          <h2 id="faq-title" className="hub-title mt-4">先问过我们的问题</h2>
        </Reveal>

        <Reveal className="mt-10">
          <div className="border-t border-[var(--border-subtle)]">
            {site.faq.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>
                  {item.q}
                  <svg
                    className="faq-chevron"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M4 6.5 9 11.5 14 6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </summary>
                <div className="faq-answer">
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

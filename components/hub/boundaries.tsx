import { platformBoundaries } from "@/config/activity";
import { Reveal } from "./reveal";

/**
 * 模块 G:平台做什么 / 不做什么。左右对照的连续排版,讲清产品边界。
 */
export function Boundaries() {
  return (
    <section id="boundaries" className="hub-section" aria-labelledby="boundaries-title">
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">平台边界</p>
          <h2 id="boundaries-title" className="hub-title mt-4 max-w-[620px]">
            平台帮你思考,不替你动手
          </h2>
          <p className="hub-body mt-4 max-w-[560px]">
            这条边界是设计出来的,不是能力缺口:思考、沉淀与组织在平台内完成;
            构建、验证与裁决在外部工具与人手中完成。
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="hub-card h-full p-7 sm:p-8">
              <p className="flex items-center gap-2.5 text-[16px] font-bold text-[var(--text-primary)]">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-evidence)" }} />
                平台负责
              </p>
              <ul className="boundary-list mt-6">
                {platformBoundaries.does.map((item) => (
                  <li key={item} className="boundary-item">
                    <span className="boundary-mark" style={{ color: "var(--accent-evidence)" }} aria-hidden>✓</span>
                    <span className="text-[var(--text-secondary)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal>
            <div className="hub-card h-full p-7 sm:p-8">
              <p className="flex items-center gap-2.5 text-[16px] font-bold text-[var(--text-primary)]">
                <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--accent-gap)" }} />
                平台不负责
              </p>
              <ul className="boundary-list mt-6">
                {platformBoundaries.doesNot.map((item) => (
                  <li key={item} className="boundary-item">
                    <span className="boundary-mark" style={{ color: "var(--accent-gap)" }} aria-hidden>✕</span>
                    <span className="text-[var(--text-secondary)]">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

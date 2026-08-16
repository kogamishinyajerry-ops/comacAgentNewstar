import { Reveal } from "./reveal";

/**
 * 模块 C“这不是一次普通比赛”:一块连续叙事区域,先讲价值判断,再讲核心标准。
 * 不做成四张等宽营销卡片(红线)。
 */
const NOTS = [
  { head: "不是比谁堆的功能多", body: "功能数量不构成价值。评委先看问题是否真实、影响是否成立。" },
  { head: "不是比谁调用的模型新", body: "换更新的模型不是创新。新场景、新方法、新组合才是。" },
];

export function ValueNarrative() {
  return (
    <section id="intro" className="hub-section" aria-labelledby="intro-title">
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">活动价值观</p>
          <h2 id="intro-title" className="hub-title mt-4 max-w-[620px]">
            这不是一次普通比赛
          </h2>
        </Reveal>

        <div className="mt-12 grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <Reveal>
            <ul className="flex flex-col">
              {NOTS.map((item) => (
                <li key={item.head} className="border-b border-[var(--border-subtle)] py-6 first:pt-0">
                  <p className="flex items-baseline gap-3 text-[18px] font-semibold text-[var(--text-primary)]">
                    <span aria-hidden className="text-[var(--text-tertiary)]">✕</span>
                    {item.head}
                  </p>
                  <p className="hub-body mt-2 pl-7">{item.body}</p>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal className="flex flex-col justify-center">
            <p className="text-[clamp(19px,1.8vw,23px)] font-semibold leading-[1.6] text-[var(--text-primary)]">
              核心,是<span className="text-[var(--accent-coach)]">发现真实问题</span>,
              证明 <span className="text-[var(--accent-coach)]">Agent 的必要性</span>,
              完成可靠实现,
            </p>
            <p className="text-[clamp(19px,1.8vw,23px)] font-semibold leading-[1.6] text-[var(--text-primary)]">
              然后拿出证据,把价值讲清楚。
            </p>
            <p className="hub-body mt-6 max-w-[480px]">
              活动评的是这条完整链路,而不是链路上任何单点的炫技。也因此,
              AI Coach 从第一问开始就在用评委的视角追问你——严格,但建设性。
            </p>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {["主张", "证据", "缺口"].map((w) => (
                <span
                  key={w}
                  className="role-tag border border-[var(--border-subtle)] bg-[var(--surface-primary)] text-[var(--text-secondary)]"
                >
                  {w}
                </span>
              ))}
              <span className="hub-caption self-center">—— 而不是伪精确的分数看板</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

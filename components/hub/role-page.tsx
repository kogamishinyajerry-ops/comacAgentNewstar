import Link from "next/link";
import { roles } from "@/config/activity";
import { Reveal } from "./reveal";
import { CoachOrb } from "./coach-orb";

/**
 * 角色说明页共用骨架:你会看到什么 / 你需要做什么 / 系统不会替你做什么。
 * 只做说明,不做空壳工作台(红线)。
 */
export function RolePage({ roleKey }: { roleKey: "participant" | "reviewer" | "organizer" }) {
  const role = roles.find((r) => r.key === roleKey)!;
  const others = roles.filter((r) => r.key !== roleKey);

  return (
    <div className="hub-container pb-24">
      <header className="hub-section !pb-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <p className="hub-eyebrow">角色说明</p>
            <h1 className="hub-title mt-4">我是{role.name}</h1>
            <p className="hub-lead mt-4 max-w-[560px]">{role.pitch}。</p>
            {roleKey === "participant" && (
              <div className="mt-7 flex flex-wrap gap-4">
                <Link href="/start" className="hub-btn hub-btn--primary">开始一次问题探索</Link>
                <Link href="/guide" className="hub-btn hub-btn--secondary">先看活动指南</Link>
              </div>
            )}
          </Reveal>
          <Reveal className="hidden justify-center lg:flex" aria-hidden="true">
            <CoachOrb state={roleKey === "participant" ? "listening" : "idle"} idPrefix={`role-${roleKey}`} size={180} />
          </Reveal>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <Reveal>
          <section className="hub-card h-full p-7" aria-labelledby={`${roleKey}-see`}>
            <h2 id={`${roleKey}-see`} className="text-[16.5px] font-bold">你会看到什么</h2>
            <ul className="mt-5 flex flex-col gap-3.5">
              {role.willSee.map((i) => (
                <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                  <span aria-hidden className="mt-0.5 text-[var(--accent-coach)]">·</span>
                  {i}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
        <Reveal>
          <section className="hub-card h-full p-7" aria-labelledby={`${roleKey}-do`}>
            <h2 id={`${roleKey}-do`} className="text-[16.5px] font-bold">你需要做什么</h2>
            <ul className="mt-5 flex flex-col gap-3.5">
              {role.mustDo.map((i) => (
                <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                  <span aria-hidden className="mt-0.5 text-[var(--text-tertiary)]">·</span>
                  {i}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
        <Reveal>
          <section className="hub-card h-full p-7" aria-labelledby={`${roleKey}-wont`}>
            <h2 id={`${roleKey}-wont`} className="text-[16.5px] font-bold">系统不会替你做什么</h2>
            <ul className="mt-5 flex flex-col gap-3.5">
              {role.wontDo.map((i) => (
                <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-[var(--text-secondary)]">
                  <span aria-hidden className="mt-0.5" style={{ color: "var(--accent-gap)" }}>✕</span>
                  {i}
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
      </div>

      {roleKey === "reviewer" && (
        <Reveal className="mt-6">
          <p className="hub-caption max-w-[640px]">
            治理原则:评委在独立判断前不会看到其他评委意见;AI 不做正式预评分。阶段一不提供任何评分功能。
          </p>
        </Reveal>
      )}
      {roleKey === "organizer" && (
        <Reveal className="mt-6">
          <p className="hub-caption max-w-[640px]">
            治理原则:管理干预透明、可确认、可撤销;组织者只看已确认或主动共享的信息。阶段一不提供态势仪表盘。
          </p>
        </Reveal>
      )}

      <Reveal className="mt-14">
        <section aria-label="其他角色" className="border-t border-[var(--border-subtle)] pt-8">
          <p className="hub-caption">同一实践场的另外两类角色</p>
          <div className="mt-4 flex flex-wrap gap-4">
            {others.map((r) => (
              <Link key={r.key} href={r.href} className="hub-btn hub-btn--secondary">
                {r.name}的说明
              </Link>
            ))}
            <Link href="/" className="hub-btn hub-btn--ghost">回到活动主页</Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

import Link from "next/link";
import { roles } from "@/config/activity";
import { Reveal } from "./reveal";
import { CoachOrb } from "./coach-orb";

type HubRoleKey = (typeof roles)[number]["key"];
type ProtectedWorkspaceHref = "/projects" | "/judge" | "/organizer";

type ProtectedWorkspaceHandoff = {
  href: ProtectedWorkspaceHref;
  label: string;
  description: string;
  secondary?: {
    href: "/workbuddy";
    label: string;
  };
};

/**
 * 公共 Hub 只交接到既有受保护工作区，绝不在这里复刻其数据、权限或动作。
 * `satisfies` 让三种公开角色与目标入口保持一一对应。
 */
const protectedWorkspaceHandoffs = {
  participant: {
    href: "/projects",
    label: "进入受保护的参赛者工作区",
    description: "先完成问题探索；具备访问权限后，再在个人工作区继续沉淀与实践。",
  },
  reviewer: {
    href: "/judge",
    label: "进入受保护的评委工作区",
    description: "在独立理解项目与证据后，由既有评委工作区承接后续的人类判断。",
  },
  organizer: {
    href: "/organizer",
    label: "进入受保护的组织者工作区",
    description: "由既有组织者工作区承接已获授权的协作与管理流程。",
    secondary: {
      href: "/workbuddy",
      label: "查看 WorkBuddy 受保护入口",
    },
  },
} as const satisfies Record<HubRoleKey, ProtectedWorkspaceHandoff>;

/**
 * 角色说明页共用骨架:你会看到什么 / 你需要做什么 / 系统不会替你做什么。
 * 只做说明,不做空壳工作台(红线)。
 */
export function RolePage({ roleKey }: { roleKey: HubRoleKey }) {
  const role = roles.find((r) => r.key === roleKey)!;
  const others = roles.filter((r) => r.key !== roleKey);
  const handoff: ProtectedWorkspaceHandoff = protectedWorkspaceHandoffs[roleKey];

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
            治理原则:评委在独立判断前不会看到其他评委意见;AI 不做正式预评分。公共 Hub 不展示或代行评分，正式评分由已授权评委在受保护工作区完成。
          </p>
        </Reveal>
      )}
      {roleKey === "organizer" && (
        <Reveal className="mt-6">
          <p className="hub-caption max-w-[640px]">
            治理原则:管理干预透明、可确认、可撤销;组织者只看已确认或主动共享的信息。公共 Hub 不展示态势仪表盘，已授权组织者在受保护工作区按规则处理管理事项。
          </p>
        </Reveal>
      )}

      <Reveal className="mt-10">
        <section
          aria-labelledby={`${roleKey}-protected-workspace`}
          className="border-t border-[var(--border-subtle)] pt-8"
          data-role-handoff={roleKey}
        >
          <p className="hub-eyebrow">受保护的下一步</p>
          <h2 id={`${roleKey}-protected-workspace`} className="mt-3 text-[22px] font-bold text-[var(--text-primary)]">
            下一步在受保护的工作区完成
          </h2>
          <p className="hub-body mt-3 max-w-[680px]">{handoff.description}</p>
          <p className="hub-caption mt-4 max-w-[680px]">
            {roleKey === "participant"
              ? "目标入口会校验你的账户。"
              : "目标入口会校验你的账户与既有角色权限。"}
            公共 Hub 不读取、不展示项目、评分或管理数据，也不执行管理动作。
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link
              href={handoff.href}
              className={`hub-btn ${roleKey === "participant" ? "hub-btn--secondary" : "hub-btn--primary"}`}
            >
              {handoff.label}
            </Link>
            {handoff.secondary && (
              <Link href={handoff.secondary.href} className="hub-btn hub-btn--ghost">
                {handoff.secondary.label}
              </Link>
            )}
          </div>
        </section>
      </Reveal>

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

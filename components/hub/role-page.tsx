import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { roles } from "@/config/activity";
import { Reveal } from "./reveal";

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

/** 交接三步:只是既有边界文案的空间化重述，不引入新业务事实。 */
const handoffSteps = [
  { title: "离开公共 Hub", detail: "本页不保存、不代行任何工作区动作。" },
  { title: "校验账户与权限", detail: "目标入口按既有登录与角色守卫处理。" },
  { title: "在受保护工作区继续", detail: "项目、评分与管理数据只在那一边出现。" },
] as const;

const ctaArrow =
  "h-4 w-4 flex-none transition-transform duration-150 ease-out group-hover:translate-x-0.5";

/**
 * 角色说明页共用骨架:你会看到什么 / 你需要做什么 / 系统不会替你做什么。
 * 只做说明,不做空壳工作台(红线)。
 *
 * 视觉策略(v2):整页只有两级尺度——一个 display 标题 + 一个交接标题;
 * 「看见 / 做到 / 边界」用 hairline 分栏的编辑式排版取代卡片堆叠;
 * 交接区是全页第二个焦点,用编号步骤给出「接下来发生什么」的空间叙事。
 */
export function RolePage({ roleKey }: { roleKey: HubRoleKey }) {
  const roleIndex = roles.findIndex((r) => r.key === roleKey);
  const role = roles[roleIndex];
  const others = roles.filter((r) => r.key !== roleKey);
  const handoff: ProtectedWorkspaceHandoff = protectedWorkspaceHandoffs[roleKey];

  const pillars = [
    {
      id: `${roleKey}-see`,
      title: "你会看到什么",
      items: role.willSee,
      marker: "dot-accent" as const,
    },
    {
      id: `${roleKey}-do`,
      title: "你需要做什么",
      items: role.mustDo,
      marker: "dot-navy" as const,
    },
    {
      id: `${roleKey}-wont`,
      title: "系统不会替你做什么",
      items: role.wontDo,
      marker: "cross-gap" as const,
    },
  ];

  return (
    <div className="hub-container pb-24">
      <header className="hub-section glow-cobalt !pb-14">
        <Reveal>
          <p className="hub-eyebrow">
            角色说明
            <span className="tnum font-semibold tracking-normal text-[var(--text-tertiary)]">
              {String(roleIndex + 1).padStart(2, "0")} / 03
            </span>
          </p>
          <h1 className="hub-display mt-5 max-w-[720px]">我是{role.name}</h1>
          <p className="hub-lead mt-6 max-w-[560px]">{role.pitch}。</p>
          {roleKey === "participant" && (
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/start" className="hub-btn hub-btn--primary group">
                开始一次问题探索
                <ArrowRight aria-hidden="true" className={ctaArrow} />
              </Link>
              <Link href="/guide" className="hub-btn hub-btn--secondary">
                先看活动指南
              </Link>
            </div>
          )}
        </Reveal>
      </header>

      <Reveal>
        <div
          role="group"
          aria-label="角色契约：看见、做到与边界"
          className="grid border-t border-[var(--hairline-strong)] md:grid-cols-3"
        >
          {pillars.map((pillar, i) => (
            <section
              key={pillar.id}
              aria-labelledby={pillar.id}
              className="border-t border-[var(--hairline)] py-9 first:border-t-0 md:border-l md:border-t-0 md:px-8 md:py-11 md:first:border-l-0 md:first:pl-0 md:last:pr-0"
            >
              <div className="flex items-baseline gap-3">
                <span
                  aria-hidden="true"
                  className="tnum font-display text-[26px] font-bold leading-none text-[var(--navy-400)]"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 id={pillar.id} className="text-[17px] font-bold text-[var(--text-primary)]">
                  {pillar.title}
                </h2>
              </div>
              <ul className="mt-6 flex flex-col gap-3.5">
                {pillar.items.map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-[14.5px] leading-relaxed text-[var(--text-secondary)]"
                  >
                    {pillar.marker === "cross-gap" ? (
                      <X
                        aria-hidden="true"
                        strokeWidth={2.5}
                        className="mt-[4px] h-3.5 w-3.5 flex-none text-[var(--accent-gap)]"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className={`hub-dot mt-[8px] ${
                          pillar.marker === "dot-accent"
                            ? "text-[var(--accent-coach)]"
                            : "text-[var(--navy-400)]"
                        }`}
                      />
                    )}
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Reveal>

      {roleKey === "reviewer" && (
        <Reveal className="mt-2">
          <p className="hub-caption max-w-[680px] border-l-2 border-[var(--hairline-cobalt)] pl-4">
            治理原则：评委在独立判断前不会看到其他评委意见；AI 不做正式预评分。公共 Hub 不展示或代行评分，正式评分由已授权评委在受保护工作区完成。
          </p>
        </Reveal>
      )}
      {roleKey === "organizer" && (
        <Reveal className="mt-2">
          <p className="hub-caption max-w-[680px] border-l-2 border-[var(--hairline-cobalt)] pl-4">
            治理原则：管理干预透明、可确认、可撤销；组织者只看已确认或主动共享的信息。公共 Hub 不展示态势仪表盘，已授权组织者在受保护工作区按规则处理管理事项。
          </p>
        </Reveal>
      )}

      <Reveal className="mt-14">
        <section
          aria-labelledby={`${roleKey}-protected-workspace`}
          className="hub-card atlas-ticks p-7 sm:p-10"
          data-role-handoff={roleKey}
        >
          <p className="hub-eyebrow">受保护的下一步</p>
          <h2
            id={`${roleKey}-protected-workspace`}
            className="hub-title mt-4 max-w-[560px]"
          >
            下一步在受保护的工作区完成
          </h2>
          <p className="hub-body mt-4 max-w-[680px]">{handoff.description}</p>

          <ol className="mt-8 grid gap-5 border-t border-[var(--hairline)] pt-7 sm:grid-cols-3 sm:gap-6">
            {handoffSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="tnum flex h-7 w-7 flex-none items-center justify-center rounded-full border border-[var(--hairline-cobalt)] text-[12.5px] font-semibold text-[var(--accent-coach)]"
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-[14.5px] font-semibold text-[var(--text-primary)]">
                    {step.title}
                  </p>
                  <p className="hub-caption mt-1">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="hub-caption mt-7 max-w-[680px]">
            {roleKey === "participant"
              ? "目标入口会校验你的账户。"
              : "目标入口会校验你的账户与既有角色权限。"}
            公共 Hub 不读取、不展示项目、评分或管理数据，也不执行管理动作。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Link
              href={handoff.href}
              className="hub-btn hub-btn--primary group"
            >
              {handoff.label}
              <ArrowRight aria-hidden="true" className={ctaArrow} />
            </Link>
            {handoff.secondary && (
              <Link href={handoff.secondary.href} className="hub-btn hub-btn--ghost group">
                {handoff.secondary.label}
                <ArrowRight aria-hidden="true" className={ctaArrow} />
              </Link>
            )}
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section aria-label="其他角色" className="border-t border-[var(--hairline)] pt-8">
          <p className="hub-caption">同一实践场的另外两类角色</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3">
            {others.map((r) => (
              <Link
                key={r.key}
                href={r.href}
                className="hub-quiet-link group inline-flex items-center gap-1.5"
              >
                {r.name}的说明
                <ArrowRight
                  aria-hidden="true"
                  className="h-3.5 w-3.5 flex-none transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
              </Link>
            ))}
            <Link href="/" className="hub-quiet-link">
              回到活动主页
            </Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}

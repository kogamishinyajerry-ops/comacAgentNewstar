import Link from "next/link";
import { roles } from "@/config/activity";
import { Reveal } from "./reveal";

/**
 * 模块 F“三类角色入口”:统一产品故事中的一个截面。
 * 参赛者是主要视觉焦点;评委与组织者为次要入口。
 */
export function RoleSection() {
  const participant = roles.find((r) => r.key === "participant")!;
  const others = roles.filter((r) => r.key !== "participant");

  return (
    <section id="roles" className="hub-section" aria-labelledby="roles-title">
      <div className="hub-container">
        <Reveal>
          <p className="hub-eyebrow">不同角色</p>
          <h2 id="roles-title" className="hub-title mt-4 max-w-[620px]">
            三类人,同一个实践场
          </h2>
          <p className="hub-body mt-4 max-w-[560px]">
            参赛者、评委与组织者在同一个产品故事里,而不是三个独立后台。
            每个角色先看到自己会看到什么、需要做什么、系统不会替你做什么。
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          {/* 参赛者:主要视觉焦点 */}
          <Reveal>
            <Link
              href={participant.href}
              className="role-card hub-card group h-full p-7 sm:p-9"
              data-primary="true"
            >
              <span className="role-tag bg-[var(--accent-coach-soft)] text-[var(--accent-coach-strong)]">
                主要角色
              </span>
              <h3 className="hub-title mt-4 text-[26px]">{participant.name}</h3>
              <p className="mt-2 max-w-[400px] text-[16.5px] font-medium leading-relaxed text-[var(--text-primary)]">
                {participant.pitch}
              </p>
              <p className="hub-body mt-4 max-w-[440px]">{participant.willSee[0]}。</p>
              <p className="mt-6 inline-flex items-center gap-2 text-[14.5px] font-semibold text-[var(--accent-coach-strong)]">
                查看{participant.name}的下一步
                <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </p>
            </Link>
          </Reveal>

          {/* 评委与组织者:次要入口 */}
          <div className="flex flex-col gap-6">
            {others.map((role) => (
              <Reveal key={role.key}>
                <Link href={role.href} className="role-card hub-card group block p-6 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-[19px] font-bold text-[var(--text-primary)]">{role.name}</h3>
                    <span aria-hidden className="text-[var(--text-tertiary)] transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </div>
                  <p className="hub-body mt-2 !text-[14px]">{role.pitch}</p>
                </Link>
              </Reveal>
            ))}
            <Reveal>
              <p className="hub-caption">
                角色说明页只讲清入口与边界；实际工作区仍通过账户与角色权限校验，公共 Hub 不读取项目、评分或管理数据。
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

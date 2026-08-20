import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/hub/reveal";
import { FaqList } from "@/components/hub/faq-list";
import {
  activity,
  activityFact,
  arrivalSteps,
  journeyNodes,
  journeyNodeStatusLabel,
  platformBoundaries,
  journeySteps,
  PENDING_LABEL,
} from "@/config/activity";
import type { ActivityRules } from "@/lib/hub/activity-config";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `活动指南 · ${site.title}`,
  description: `${site.brand.name}活动指南：参与路径、平台边界与当前配置状态。`,
};

type GuideFact = {
  label: string;
  value: string;
  links?: Array<{ href: string; label: string }>;
};

const RULE_LABELS: Record<keyof ActivityRules, string> = {
  participation: "参与方式",
  teamSize: "团队人数",
  workRelated: "工作关联",
  externalTools: "外部工具",
  dataSecurityAndIp: "数据、保密与知识产权",
  submissionMaterials: "提交材料",
  evaluation: "评审方式",
};

const publicRules: ActivityRules = activity.rules;

const configuredRules = (Object.keys(RULE_LABELS) as Array<keyof ActivityRules>).flatMap((key) => {
  const rule = publicRules[key];
  return rule ? [{ label: RULE_LABELS[key], summary: rule.summary, sourceUrl: rule.sourceUrl }] : [];
});

const FACTS = [
  { label: "活动周期", value: `${activityFact(activity.dates.startDate)} — ${activityFact(activity.dates.endDate)}` },
  { label: "报名截止", value: activityFact(activity.dates.registrationDeadline) },
  activity.links.registration
    ? {
        label: "报名方式",
        value: "前往报名入口",
        links: [{ href: activity.links.registration, label: "打开报名入口" }],
      }
    : { label: "报名方式", value: activity.displayFallback },
  { label: "主办单位", value: activity.organizers.length > 0 ? activity.organizers.join(" · ") : activity.displayFallback },
  {
    label: "团队与提交规则",
    value: configuredRules.length > 0
      ? configuredRules.map((rule) => `${rule.label}：${rule.summary}`).join("；")
      : activity.displayFallback,
    links: configuredRules.flatMap((rule) => rule.sourceUrl
      ? [{ href: rule.sourceUrl, label: `${rule.label}正式来源` }]
      : []),
  },
] satisfies GuideFact[];

export default function GuidePage() {
  return (
    <div className="hub-container pb-24">
      <header className="hub-section !pb-8">
        <Reveal>
          <p className="hub-eyebrow">活动指南</p>
          <h1 className="hub-title mt-4 max-w-[680px]">活动如何进行</h1>
          <p className="hub-lead mt-5 max-w-[620px]">
            一句话:由 AI Coach 陪你,把一个真实问题逐步变成可构建、可验证、可展示的 AI Agent 作品。
            下面是路径、边界与当前的配置状态。
          </p>
        </Reveal>
      </header>

      <Reveal>
        <section aria-labelledby="guide-journey" className="hub-card p-7 sm:p-8" data-guide-journey>
          <h2 id="guide-journey" className="text-[18px] font-bold">四周旅程:现在走到哪一步</h2>
          <p className="hub-body mt-2 max-w-[560px]">
            活动分四周、四个节点。当前只有 N1 问答初筛开放;其余节点结构可见、开放时间待活动配置确认,我们不预支未开放的能力。
          </p>

          {/* G0 到场三件套(P0-2):链接未确认一律 pending */}
          <div className="mt-7">
            <p className="seed-slot-label">G0 · 到场三件套</p>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {arrivalSteps.map((step) => (
                <li
                  key={step.key}
                  className="rounded-xl border border-[var(--border-subtle)] p-4"
                  data-guide-arrival={step.key}
                >
                  <p className="text-[14.5px] font-bold text-[var(--text-primary)]">
                    {step.index}. {step.title}
                    {step.current && (
                      <span className="ml-2 text-[12px] font-semibold text-[var(--text-tertiary)]">（你在这里）</span>
                    )}
                  </p>
                  <p className="hub-caption mt-1.5">{step.detail}</p>
                  <p className="mt-2 text-[13px]">
                    {step.href ? (
                      <a href={step.href} target="_blank" rel="noreferrer" className="hub-quiet-link">
                        打开链接<span className="sr-only">（在新窗口打开）</span>
                      </a>
                    ) : step.current ? (
                      <Link href="/start" className="hub-quiet-link">进入问题探索</Link>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">{PENDING_LABEL}</span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* 四节点:结构可见、日期 pending;只有 N1 可进入 */}
          <ol className="mt-8 flex flex-col">
            {journeyNodes.map((node) => (
              <li
                key={node.key}
                className="flex flex-col gap-1.5 border-b border-[var(--border-subtle)] py-5 first:pt-0 last:border-none sm:flex-row sm:items-baseline sm:gap-6"
                data-guide-node={node.key}
                data-guide-node-status={node.status}
              >
                <p className="w-[220px] flex-none text-[15px] font-bold text-[var(--text-primary)]">
                  {node.node} {node.name}
                  <span className="ml-2 text-[12.5px] font-semibold text-[var(--text-tertiary)]">{node.week}</span>
                </p>
                <p className="hub-body flex-1">产出:{node.outcome}</p>
                <p className="flex-none text-[13.5px]">
                  {node.href ? (
                    <Link href={node.href} className="hub-quiet-link">
                      {journeyNodeStatusLabel(node)} · 进入
                    </Link>
                  ) : (
                    <span className="text-[var(--text-tertiary)]">{journeyNodeStatusLabel(node)}</span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section aria-labelledby="guide-status" className="hub-card p-7 sm:p-8">
          <h2 id="guide-status" className="text-[18px] font-bold">当前活动配置状态</h2>
          <p className="hub-body mt-2 max-w-[560px]">
            日期、报名与规则以活动正式通知为准。以下未定项保持“待活动配置确认”,我们不预先编造。
          </p>
          <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {FACTS.map((f) => (
              <div key={f.label} className="flex flex-col border-b border-[var(--border-subtle)] pb-3">
                <dt className="text-[13px] font-semibold tracking-[0.04em] text-[var(--text-tertiary)]">{f.label}</dt>
                <dd className={`mt-1 text-[14.5px] ${f.value === activity.displayFallback ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                  {f.value}
                  {f.links?.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hub-quiet-link ml-3 text-[13px]"
                    >
                      {link.label}<span className="sr-only">（在新窗口打开）</span>
                    </a>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section aria-labelledby="guide-path">
          <h2 id="guide-path" className="hub-title text-[26px]">方法论:五段实践路径,不是十个步骤</h2>
          <p className="hub-body mt-3 max-w-[640px]">
            四节点旅程是操作层;这五段是贯穿每个节点的做事方法——从真实问题出发,以证据收尾。
          </p>
          <ol className="mt-8 flex flex-col">
            {journeySteps.map((step) => (
              <li key={step.key} className="flex gap-5 border-b border-[var(--border-subtle)] py-6 first:pt-0 last:border-none">
                <span className="journey-index pt-1">{step.index}</span>
                <div>
                  <p className="text-[17px] font-bold text-[var(--text-primary)]">{step.title}</p>
                  <p className="hub-body mt-1.5 max-w-[640px]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section aria-labelledby="guide-boundary" className="hub-card p-7 sm:p-8">
          <h2 id="guide-boundary" className="text-[18px] font-bold">平台边界(重要)</h2>
          <div className="mt-6 grid gap-8 sm:grid-cols-2">
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--accent-evidence)" }}>平台负责</p>
              <ul className="boundary-list mt-4">
                {platformBoundaries.does.map((i) => (
                  <li key={i} className="boundary-item">
                    <span className="boundary-mark" style={{ color: "var(--accent-evidence)" }} aria-hidden>✓</span>
                    <span className="text-[var(--text-secondary)]">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--accent-gap)" }}>平台不负责</p>
              <ul className="boundary-list mt-4">
                {platformBoundaries.doesNot.map((i) => (
                  <li key={i} className="boundary-item">
                    <span className="boundary-mark" style={{ color: "var(--accent-gap)" }} aria-hidden>✕</span>
                    <span className="text-[var(--text-secondary)]">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal className="mt-14">
        <section aria-labelledby="guide-next">
          <h2 id="guide-next" className="hub-title text-[26px]">你的下一步</h2>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/start" className="hub-btn hub-btn--primary">开始一次问题探索</Link>
            <Link href="/role/participant" className="hub-btn hub-btn--secondary">我是参赛者</Link>
            <Link href="/role/reviewer" className="hub-btn hub-btn--secondary">我是评委</Link>
            <Link href="/role/organizer" className="hub-btn hub-btn--secondary">我是组织者</Link>
          </div>
          <p className="hub-caption mt-4">
            三幕探索的终点是一枚可复制带走的问题种子;登录、报名与完整实践流程将在活动配置确认后开放,当前不提供占位链接。
          </p>
        </section>
      </Reveal>

      {/* FAQ 五问:含"不会编程能参加吗"等边界沟通,此前无任何页面承载(§21) */}
      <FaqList />
    </div>
  );
}

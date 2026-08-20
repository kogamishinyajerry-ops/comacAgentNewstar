import Link from "next/link";
import type { Metadata } from "next";
import { Fragment } from "react";
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
  /** 区间型日期:逐段渲染,未确认段与其他字段一致用虚线胶囊标注 */
  parts?: string[];
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
  {
    label: "活动周期",
    value: `${activityFact(activity.dates.startDate)} — ${activityFact(activity.dates.endDate)}`,
    parts: [activityFact(activity.dates.startDate), activityFact(activity.dates.endDate)],
  },
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

/** 节点状态点:进行中=实心钴蓝 + 光晕,未开放=空心刻线圈——不依赖颜色之外没有其他编码,
    状态同时由文字标签承担(「进行中」/「第 N 周开放 · 待活动配置确认」)。 */
function NodeStatusDot({ status }: { status: string }) {
  const active = status === "in-progress";
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 flex-none rounded-full"
      style={{
        background: active ? "var(--accent-coach)" : "transparent",
        boxShadow: active
          ? "0 0 0 4px var(--accent-coach-soft)"
          : "inset 0 0 0 1.5px var(--border-control)",
      }}
    />
  );
}

export default function GuidePage() {
  return (
    <div className="hub-container pb-24">
      <header className="hub-section glow-cobalt !pb-10">
        <Reveal>
          <p className="hub-eyebrow">活动指南</p>
          <h1 className="hub-display mt-5 max-w-[720px]">活动如何进行</h1>
          <p className="hub-lead mt-6 max-w-[620px]">
            一句话：由 AI Coach 陪你，把一个真实问题逐步变成可构建、可验证、可展示的 AI Agent 作品。
            下面是路径、边界与当前的配置状态。
          </p>
        </Reveal>
      </header>

      <Reveal>
        <section aria-labelledby="guide-journey" className="hub-card atlas-ticks p-7 sm:p-9" data-guide-journey>
          <p className="hub-eyebrow">四周旅程</p>
          <h2 id="guide-journey" className="mt-4 font-display text-[24px] font-bold text-[var(--text-primary)]">
            现在走到哪一步
          </h2>
          <p className="hub-body mt-3 max-w-[560px]">
            活动分四周、四个节点。当前只有 N1 问答初筛开放；其余节点结构可见、开放时间待活动配置确认，我们不预支未开放的能力。
          </p>

          {/* G0 到场三件套(P0-2):链接未确认一律 pending */}
          <div className="mt-9">
            <p className="seed-slot-label">G0 · 到场三件套</p>
            <ol className="mt-4 grid gap-4 sm:grid-cols-3">
              {arrivalSteps.map((step) => (
                <li
                  key={step.key}
                  className={`rounded-xl border p-5 ${
                    step.current
                      ? "border-[var(--hairline-cobalt)] bg-[var(--surface-focus)] shadow-[var(--shadow-xs)]"
                      : "border-[var(--border-subtle)]"
                  }`}
                  data-guide-arrival={step.key}
                >
                  <p className="text-[14.5px] font-bold text-[var(--text-primary)]">
                    <span className="mr-2 tabular-nums text-[var(--text-tertiary)]">{step.index}.</span>
                    {step.title}
                  </p>
                  {step.current && (
                    <p className="mt-2">
                      <span className="inline-flex items-center rounded-full border border-[var(--hairline-cobalt)] bg-[var(--accent-coach-soft)] px-2.5 py-0.5 text-[12px] font-semibold text-[var(--accent-coach-strong)]">
                        你在这里
                      </span>
                    </p>
                  )}
                  <p className="hub-caption mt-2.5">{step.detail}</p>
                  <p className="mt-3 text-[13px]">
                    {step.href ? (
                      <a href={step.href} target="_blank" rel="noreferrer" className="hub-quiet-link">
                        打开链接<span className="sr-only">（在新窗口打开）</span>
                      </a>
                    ) : step.current ? (
                      <Link href="/start" className="hub-quiet-link">进入问题探索</Link>
                    ) : (
                      <span className="hub-pending">{PENDING_LABEL}</span>
                    )}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* 四节点:结构可见、日期 pending;只有 N1 可进入。
              状态点 + 文字标签双编码:进行中(实心)→ 未开始(空心),用户永不迷路 */}
          <ol className="mt-9 flex flex-col">
            {journeyNodes.map((node) => (
              <li
                key={node.key}
                className="flex flex-col gap-2 border-b border-[var(--hairline)] py-5 first:pt-0 last:border-none sm:flex-row sm:items-center sm:gap-6"
                data-guide-node={node.key}
                data-guide-node-status={node.status}
              >
                <p className="flex w-[240px] flex-none items-center gap-3.5 text-[15px] font-bold text-[var(--text-primary)]">
                  <NodeStatusDot status={node.status} />
                  {node.node} {node.name}
                  <span className="ml-1 text-[12.5px] font-semibold text-[var(--text-tertiary)] tabular-nums">{node.week}</span>
                </p>
                <p className="hub-body flex-1 sm:pl-[26px]">产出：{node.outcome}</p>
                <p className="flex-none text-[13.5px] sm:pl-[26px]">
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

      <Reveal className="mt-16">
        <section aria-labelledby="guide-status" className="hub-card p-7 sm:p-9">
          <h2 id="guide-status" className="font-display text-[24px] font-bold text-[var(--text-primary)]">
            当前活动配置状态
          </h2>
          <p className="hub-body mt-3 max-w-[560px]">
            日期、报名与规则以活动正式通知为准。以下未定项保持“待活动配置确认”，我们不预先编造。
          </p>
          <dl className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            {FACTS.map((f) => {
              const exactPending = f.value === activity.displayFallback;
              const containsPending = f.value.includes(PENDING_LABEL);
              return (
                <div key={f.label} className="flex flex-col border-b border-[var(--hairline)] pb-4">
                  <dt className="text-[12px] font-semibold tracking-[0.14em] text-[var(--text-tertiary)]">{f.label}</dt>
                  <dd className="mt-2 text-[14.5px] text-[var(--text-primary)]">
                    {f.parts ? (
                      /* 区间型日期:确认段平文本、未确认段虚线胶囊,与其他字段的 pending 表达一致 */
                      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1.5">
                        {f.parts.map((part, i) => (
                          <Fragment key={`${f.label}-${i}`}>
                            {i > 0 && (
                              <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                                —
                              </span>
                            )}
                            {part === PENDING_LABEL ? (
                              <span className="hub-pending">{part}</span>
                            ) : (
                              <span>{part}</span>
                            )}
                          </Fragment>
                        ))}
                      </span>
                    ) : exactPending ? (
                      <span className="hub-pending">{PENDING_LABEL}</span>
                    ) : (
                      <span className={containsPending ? "text-[var(--text-tertiary)]" : undefined}>
                        {f.value}
                      </span>
                    )}
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
              );
            })}
          </dl>
        </section>
      </Reveal>

      <Reveal className="mt-20">
        <section aria-labelledby="guide-path">
          <p className="hub-eyebrow">方法论</p>
          {/* 可访问名保持既有契约「方法论:五段实践路径,不是十个步骤」(hub-journey e2e / aria-labelledby),
              视觉上「方法论」已由眉行承担;完整名放 sr-only,可见副本 aria-hidden(避免浏览器在内联边界插空格) */}
          <h2 id="guide-path" className="hub-title mt-4">
            <span className="sr-only">方法论:五段实践路径,不是十个步骤</span>
            <span aria-hidden="true">五段实践路径，不是十个步骤</span>
          </h2>
          <p className="hub-body mt-4 max-w-[640px]">
            四节点旅程是操作层；这五段是贯穿每个节点的做事方法——从真实问题出发，以证据收尾。
          </p>
          <ol className="mt-10 flex flex-col">
            {journeySteps.map((step) => (
              <li key={step.key} className="flex gap-6 border-b border-[var(--hairline)] py-7 first:pt-0 last:border-none">
                <span className="journey-index pt-1 tabular-nums">{step.index}</span>
                <div>
                  <p className="text-[17px] font-bold text-[var(--text-primary)]">{step.title}</p>
                  <p className="hub-body mt-2 max-w-[640px]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </Reveal>

      <Reveal className="mt-20">
        <section aria-labelledby="guide-boundary" className="hub-card p-7 sm:p-9">
          <h2 id="guide-boundary" className="font-display text-[24px] font-bold text-[var(--text-primary)]">
            平台边界（重要）
          </h2>
          <div className="mt-8 grid gap-10 sm:grid-cols-2">
            <div>
              <p className="text-[13px] font-semibold tracking-[0.14em]" style={{ color: "var(--accent-evidence)" }}>平台负责</p>
              <ul className="boundary-list mt-5">
                {platformBoundaries.does.map((i) => (
                  <li key={i} className="boundary-item">
                    <span className="boundary-mark" style={{ color: "var(--accent-evidence)" }} aria-hidden>✓</span>
                    <span className="text-[var(--text-secondary)]">{i}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-semibold tracking-[0.14em]" style={{ color: "var(--accent-gap)" }}>平台不负责</p>
              <ul className="boundary-list mt-5">
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

      <Reveal className="mt-20">
        <section aria-labelledby="guide-next">
          <p className="hub-eyebrow">行动</p>
          <h2 id="guide-next" className="hub-title mt-4">你的下一步</h2>
          <div className="mt-9 flex flex-wrap gap-4">
            <Link href="/start" className="hub-btn hub-btn--primary">开始一次问题探索</Link>
            <Link href="/role/participant" className="hub-btn hub-btn--secondary">我是参赛者</Link>
            <Link href="/role/reviewer" className="hub-btn hub-btn--secondary">我是评委</Link>
            <Link href="/role/organizer" className="hub-btn hub-btn--secondary">我是组织者</Link>
          </div>
          <p className="hub-caption mt-5 max-w-[600px]">
            三幕探索的终点是一枚可复制带走的问题种子；登录、报名与完整实践流程将在活动配置确认后开放，当前不提供占位链接。
          </p>
        </section>
      </Reveal>

      {/* FAQ 五问:含"不会编程能参加吗"等边界沟通,此前无任何页面承载(§21) */}
      <FaqList />
    </div>
  );
}

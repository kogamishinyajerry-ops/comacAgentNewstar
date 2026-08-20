"use client";

import { useState } from "react";
import { CoachOrb, COACH_STATE_LABELS } from "@/components/hub/coach-orb";
import { SeedCard } from "@/components/hub/seed-card";
import { composeSeed, createCoachState, beginCoach, submitAnswer, advance } from "@/lib/hub/coach-machine";
import { journeySteps } from "@/config/activity";
import { seedCopy } from "@/fixtures/coach-demo";

const SURFACE_TOKENS = [
  ["--surface-canvas", "画布"],
  ["--surface-primary", "主表面"],
  ["--surface-focus", "焦点表面"],
  ["--surface-muted", "弱表面"],
] as const;

const TEXT_TOKENS = [
  ["--text-primary", "主文字 深海军蓝"],
  ["--text-secondary", "次级文字"],
  ["--text-tertiary", "三级文字"],
] as const;

const ACCENT_TOKENS = [
  ["--accent-coach", "钴蓝 Coach"],
  ["--accent-purple", "淡紫 质询"],
  ["--accent-evidence", "青绿 证据"],
  ["--accent-gap", "琥珀 缺口"],
  ["--state-danger", "危险态"],
] as const;

const MOTION_DEMOS = [
  ["motion-rise", "端上来", "内容自下浮现,260–340ms"],
  ["motion-grow", "长出来", "从顶部生长,用于列表与轨迹"],
  ["motion-approach", "取到眼前", "关键物靠近并获得焦点"],
  ["motion-condense", "凝结", "问题种子出现,带轻微聚焦收束"],
  ["motion-pulse-once", "吸附脉冲", "confirmed 后的一次脉冲,随后静止"],
] as const;

function Section({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="hub-section !pb-12 !pt-4">
      <h2 className="hub-title text-[24px]">{title}</h2>
      {note && <p className="hub-body mt-2 max-w-[640px]">{note}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

export default function DevScenariosPage() {
  const [orbState, setOrbState] = useState<
    "idle" | "listening" | "challenging" | "condensing" | "confirmed"
  >("idle");
  const [demoKey, setDemoKey] = useState(0);
  const [demoClass, setDemoClass] = useState("motion-rise");
  const [receded, setReceded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  /* 由状态机直接构造一个已完成的种子样例(先经建立拍 begin 进入第一幕) */
  const seedSample = (() => {
    let s = beginCoach(createCoachState("problem"));
    for (const answer of [
      "试验异常发生后,记录、依据和处理结果分散在三处,人工对账要来回翻找",
      "影响试验工程师与复核人;每次对账约多花两小时,口径不一致还会返工",
      "需要记住项目历史口径,并按固定流程调用检索工具逐步核对、留下痕迹",
    ]) {
      s = advance(submitAnswer(s, answer));
    }
    return composeSeed(s);
  })();
  /* 场景演示页的导出元信息只是展示样例,固定值不冒充真实会话 */
  const seedSampleMeta = {
    generatedAt: new Date(2026, 7, 20, 10, 30),
    cardId: "QD-DEMO1",
  };

  return (
    <div className="hub-container pb-24">
      <header className="hub-section !pb-6">
        <p className="hub-eyebrow">内部验收</p>
        <h1 className="hub-title mt-3">/dev/scenarios — 组件、状态与动效验收</h1>
        <p className="hub-body mt-3 max-w-[680px]">
          集中呈现 Hub 设计系统的可验收面:色彩与字体 Token、语义组件、Coach 平面标记五种视觉状态、
          七个空间动词动效与问题种子。系统开启“减弱动态”时,所有位移动效取消,信息顺序不变。
        </p>
      </header>

      <Section id="tokens" title="1 · 色彩 Token" note="组件不得散落硬编码颜色,一律引用语义变量。">
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { title: "表面", tokens: SURFACE_TOKENS },
            { title: "文字", tokens: TEXT_TOKENS },
            { title: "强调与状态", tokens: ACCENT_TOKENS },
          ].map((group) => (
            <div key={group.title}>
              <p className="hub-caption mb-3">{group.title}</p>
              <ul className="flex flex-col gap-2.5">
                {group.tokens.map(([token, label]) => (
                  <li key={token} className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border-subtle)]"
                      style={{ background: `var(${token})` }}
                    />
                    <span className="text-[13px]">
                      <code className="text-[var(--text-secondary)]">{token}</code>
                      <span className="ml-2 text-[var(--text-tertiary)]">{label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="type" title="2 · 字体层级" note="中文无大写科技感;主标题与正文之间靠字号与留白分层。">
        <div className="hub-card p-6 sm:p-8">
          <p className="hub-eyebrow">Eyebrow 层</p>
          <p className="hub-display mt-3">把一个真实问题,变成可验证的 AI Agent 作品</p>
          <p className="hub-title mt-5">模块标题:一次一问,一幕一决策</p>
          <p className="hub-lead mt-4">导语:AI Coach 不替你写答案,它一次只追问一个关键问题。</p>
          <p className="hub-body mt-3">
            正文:证据优先于完成率。前台使用“主张—证据—缺口”,不展示健康分、排行榜或完成率。
          </p>
          <p className="hub-caption mt-3">说明文字:活动日期、报名链接等未确认信息一律显示“待活动配置确认”。</p>
          <span className="hub-pending mt-4">待活动配置确认</span>
        </div>
      </Section>

      <Section id="controls" title="3 · 按钮与回答器" note="触达热区 ≥44px;错误显示在输入附近,不只靠 Toast。">
        <div className="hub-card flex flex-col gap-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" className="hub-btn hub-btn--primary">主按钮</button>
            <button type="button" className="hub-btn hub-btn--secondary">次按钮</button>
            <button type="button" className="hub-btn hub-btn--ghost">弱化按钮</button>
            <a className="hub-quiet-link" href="#controls">低强调链接</a>
          </div>
          <form
            className="max-w-[560px]"
            onSubmit={(e) => {
              e.preventDefault();
              setInputError(inputValue.trim() ? null : "这一问还没有回答——哪怕一句也好");
            }}
          >
            <label htmlFor="demo-answer" className="mb-2 block text-[14px] font-semibold">
              回答器(空提交可验证行内错误)
            </label>
            <textarea
              id="demo-answer"
              className="hub-textarea"
              rows={3}
              placeholder="例如:试验异常记录分散在三处,对账要来回翻找……"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError(null);
              }}
            />
            {inputError && (
              <p className="hub-field-error mt-2.5" role="alert">
                <span aria-hidden>↖</span>
                {inputError}
              </p>
            )}
            <button type="submit" className="hub-btn hub-btn--primary mt-4">提交这一问的回答</button>
          </form>
        </div>
      </Section>

      <Section
        id="orb"
        title="4 · Coach 平面标记五状态"
        note="真实平面插画资产 + CSS 状态变换;不模拟球体、体积光或说话动作。"
      >
        <div className="grid items-start gap-10 lg:grid-cols-[300px_1fr]">
          <div className="flex justify-center" aria-hidden="true">
            <CoachOrb state={orbState} idPrefix="scenarios-orb" size={260} />
          </div>
          <div role="radiogroup" aria-label="选择 Coach 平面标记状态" className="flex flex-col gap-3">
            {(Object.keys(COACH_STATE_LABELS) as (keyof typeof COACH_STATE_LABELS)[]).map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-3 transition-colors has-[:checked]:border-[var(--accent-coach)] has-[:checked]:bg-[var(--surface-focus)]"
              >
                <input
                  type="radio"
                  name="orb-state"
                  value={s}
                  checked={orbState === s}
                  onChange={() => setOrbState(s)}
                  className="accent-[var(--accent-coach)]"
                />
                <span className="text-[15px] font-semibold">{COACH_STATE_LABELS[s]}</span>
                <code className="ml-auto text-[12.5px] text-[var(--text-tertiary)]">{s}</code>
              </label>
            ))}
            <p className="hub-caption mt-2">
              idle 静候 / listening 倾听(回答器聚焦)/ challenging 质询(提交后)/ condensing 凝结(第三幕后收拢)/
              confirmed 已确认(种子出现,一次脉冲后静止)
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="motion"
        title="5 · 动效语言:七个空间动词"
        note="点击重放;“退到背景”为切换态。减弱动态时全部取消位移。"
      >
        <div className="grid gap-8 md:grid-cols-2">
          <div className="hub-card p-6">
            <div className="flex flex-wrap gap-3">
              {MOTION_DEMOS.map(([cls, name, desc]) => (
                <button
                  key={cls}
                  type="button"
                  className="hub-btn hub-btn--secondary !min-h-[38px] !px-4 !text-[13.5px]"
                  onClick={() => {
                    setDemoClass(cls);
                    setDemoKey((k) => k + 1);
                  }}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                className="hub-btn hub-btn--secondary !min-h-[38px] !px-4 !text-[13.5px]"
                onClick={() => setReceded((v) => !v)}
              >
                退到背景(切换)
              </button>
            </div>
            <div className="mt-6 flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)]">
              <div
                key={demoKey}
                className={`${demoClass} hub-inset px-5 py-4 text-[14px] text-[var(--text-primary)]`}
                style={
                  receded
                    ? { opacity: 0.4, transform: "scale(0.94)", filter: "saturate(0.6)" }
                    : undefined
                }
              >
                被端上来的内容
              </div>
            </div>
            <p className="hub-caption mt-4">
              当前演示:{MOTION_DEMOS.find(([c]) => c === demoClass)?.[2] ?? "收拢由 Coach 场景转场内置(已回答的一幕让出焦点)"}
              {receded ? ";当前处于退到背景态" : ""}
            </p>
          </div>
          <div className="hub-card p-6">
            <p className="text-[15px] font-semibold">时长与缓动</p>
            <dl className="mt-4 flex flex-col gap-3 text-[14px]">
              {[
                ["微交互", "160–200ms"],
                ["内容端上", "260–340ms"],
                ["场景切换", "480–620ms"],
                ["Hero 三拍编排", "总时长 ≤ 1.2s"],
                ["缓动", "cubic-bezier(0.22, 1, 0.36, 1)"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between border-b border-[var(--border-subtle)] pb-2.5">
                  <dt className="text-[var(--text-secondary)]">{k}</dt>
                  <dd className="tabular-nums text-[var(--text-primary)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Section>

      <Section id="journey" title="6 · 实践路径:滚动点亮" note="桌面横向轨迹,移动端单焦点;非当前阶段退到背景。">
        <ol className="grid gap-5 md:grid-cols-5">
          {journeySteps.map((step, i) => (
            <li key={step.key} className="journey-step hub-inset p-4" data-current={i === 1 ? "true" : "false"}>
              <span className="journey-index">{step.index}</span>
              <div className="journey-dot mt-3" aria-hidden="true" />
              <p className="mt-3 text-[14.5px] font-semibold">{step.title}</p>
              <p className="hub-caption mt-1.5">{step.summary}</p>
            </li>
          ))}
        </ol>
        <p className="hub-caption mt-4">示例中 02 为当前阶段(data-current=&quot;true&quot;)。</p>
      </Section>

      <Section id="seed" title="7 · 问题种子" note="三幕凝结产物:主张摘录 + 诚实缺口,不是“项目创建成功”。">
        <div className="max-w-[720px]">
          <SeedCard seed={seedSample} meta={seedSampleMeta} />
        </div>
      </Section>

      <Section id="a11y" title="8 · 无障碍与降级" note="键盘路径与减弱动态的验收要点。">
        <ul className="list-disc space-y-2 pl-5 text-[14.5px] text-[var(--text-secondary)]">
          <li>全部按钮、链接、输入可 Tab 到达;焦点环清晰克制</li>
          <li>Coach 场景更迭通过 aria-live 播报当前问题,不重复整幕</li>
          <li>图标按钮均有可访问名称;颜色不是唯一状态编码(缺口同时用 ◇ 与文案)</li>
          <li>prefers-reduced-motion:位移动效取消、信息顺序不变(本页所有演示可直接验证)</li>
          <li>FAQ 与页脚在无 JS 时可读可用</li>
        </ul>
      </Section>
    </div>
  );
}

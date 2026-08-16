import Link from "next/link";
import { CoachFlow } from "@/components/hub/coach-flow";
import { Reveal } from "@/components/hub/reveal";
import { coachPrivacyNotice, type CoachEntry } from "@/fixtures/coach-demo";

const ENTRIES: { key: CoachEntry; label: string; href: string; note: string }[] = [
  {
    key: "problem",
    label: "从一个真实问题开始",
    href: "/start",
    note: "你还没有明确想法,从一个具体的工作瞬间出发",
  },
  {
    key: "idea",
    label: "我已经有一个想法",
    href: "/start?entry=idea",
    note: "你带着方案来,Coach 的第一问会先检验问题本身",
  },
];

export default async function StartPage({
  searchParams,
}: {
  searchParams: { entry?: string };
}) {
  const entry: CoachEntry = searchParams?.entry === "idea" ? "idea" : "problem";
  const active = ENTRIES.find((e) => e.key === entry)!;

  return (
    <div className="hub-container flex min-h-[calc(100dvh-68px)] flex-col pb-20 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="hub-quiet-link">
          ← 回到活动主页
        </Link>
        <span className="hub-pending">AI Coach 预览 · 一问一幕</span>
      </div>

      <Reveal className="mt-10">
        <h1 className="hub-title max-w-[620px]">AI Coach 问题探索</h1>
        <p className="hub-body mt-3 max-w-[560px]">
          三幕,一幕一问。每一幕你会先看到 Coach 的当前判断与它指出的最大风险,
          然后回答一个关键问题。{active.note}
        </p>
      </Reveal>

      {/* 入口切换:两条不同起点的确定性路径 */}
      <Reveal className="mt-8">
        <div
          className="flex flex-col gap-3 sm:flex-row"
          role="group"
          aria-label="选择探索入口"
        >
          {ENTRIES.map((e) => (
            <Link
              key={e.key}
              href={e.href}
              aria-current={e.key === entry ? "true" : undefined}
              className={`hub-btn ${e.key === entry ? "hub-btn--primary" : "hub-btn--secondary"} sm:flex-1`}
            >
              {e.label}
            </Link>
          ))}
        </div>
        <p className="hub-caption mt-3">
          {entry === "idea"
            ? "注意:已有想法入口不会直接认可功能设想,第一问仍是“真实问题是什么”。"
            : "主入口推荐:大多数好作品都从一个真实瞬间长出来,而不是从功能清单开始。"}
        </p>
      </Reveal>

      <div className="mx-auto mt-12 w-full max-w-[880px] flex-1">
        <CoachFlow key={entry} entry={entry} orbIdPrefix="start-coach" />
      </div>

      <p className="hub-caption mt-12 text-center">
        {coachPrivacyNotice} 刷新后当前会话会清空;完整实践流程将在活动配置确认后开放。
      </p>
    </div>
  );
}

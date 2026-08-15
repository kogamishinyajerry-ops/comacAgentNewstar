import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, LinkButton, Badge } from "@/components/ui";
import { TRACKS } from "@/lib/constants";
import { DailyInspiration } from "@/components/daily-art";
import { Seal } from "@/components/seal";

export default async function HomePage() {
  const [config, user] = await Promise.all([
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
    getCurrentUser(),
  ]);
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  return (
    <div className="space-y-8 py-6">
      {/* 编辑风主视觉:纸墨 + 朱砂印章 + 刻线 */}
      <section className="tick-corners relative overflow-hidden rounded-lg border border-ink-900/10 bg-[#fffdf8] px-8 py-12 lg:px-14">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div className="max-w-2xl">
            <p className="kicker">Internal Innovation Program · 2026</p>
            <h1 className="font-display mt-4 text-[38px] font-bold leading-[1.25] tracking-tight text-ink-900 lg:text-[46px]">
              发现一个真问题,
              <br />
              做一个<span className="relative mx-1 inline-block text-brand-600">
                可验证
                <svg className="absolute -bottom-1.5 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 5 C 60 1, 140 8, 198 3" stroke="#b94a26" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
                </svg>
              </span>的解法。
            </h1>
            <p className="mt-5 max-w-xl text-[14px] leading-7 text-ink-500">
              {config?.intro ||
                "不做宏大平台,只做一条从真问题到可验证解法的小实验路径:10步向导、5个测试案例、三项轻交付,四维40分评审。"}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {user ? (
                <LinkButton href={user.role === "JUDGE" ? "/judge" : user.role === "ORGANIZER" || user.role === "ADMIN" ? "/organizer" : "/projects"} size="lg">
                  进入工作台 →
                </LinkButton>
              ) : (
                <>
                  <LinkButton href="/register" size="lg">注册参与</LinkButton>
                  <LinkButton href="/login" variant="secondary" size="lg">登录</LinkButton>
                </>
              )}
              <LinkButton href="/?demo=1" variant="ghost" size="lg" className="text-ink-500">▶ 观看自动演示</LinkButton>
              <LinkButton href="/inspirations" variant="ghost" size="lg" className="text-ink-500">案例灵感</LinkButton>
            </div>
            {config?.submissionDeadline && (
              <p className="mt-6 flex items-center gap-2 text-xs tracking-wide text-ink-400">
                <span className="inline-block h-3 w-[3px] bg-brand-500" />
                {config.startDate ?? "?"} — {config.endDate ?? "?"} · 提交截止 {config.submissionDeadline}
              </p>
            )}
          </div>
          {/* 印章主视觉 */}
          <div className="relative hidden lg:block">
            <div className="flex h-56 w-56 items-center justify-center rounded-full border border-ink-900/15">
              <div className="flex h-44 w-44 items-center justify-center rounded-full border border-dashed border-ink-900/20">
                <Seal size={88} char="解" tilt />
              </div>
            </div>
            <span className="absolute -right-2 top-6 rotate-90 text-[10px] tracking-[0.3em] text-ink-300">VERIFY · BUILD · SHIP</span>
            <span className="absolute -left-6 bottom-8 -rotate-90 text-[10px] tracking-[0.3em] text-ink-300">EXPERIMENT NO.001</span>
          </div>
        </div>
        {/* 底部数据条 */}
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded border border-ink-900/10 bg-ink-900/10 sm:grid-cols-4">
          {[
            ["10", "步引导流程"],
            ["5", "例测试要求"],
            ["3", "项轻交付"],
            ["40", "分四维评审"],
          ].map(([n, l]) => (
            <div key={l} className="flex items-baseline gap-2 bg-[#fffdf8] px-4 py-3">
              <span className="font-display tnum text-2xl font-bold text-brand-600">{n}</span>
              <span className="text-xs text-ink-500">{l}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DailyInspiration />
        <Card title="参赛规则速览">
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-5 text-slate-600">
            <li>每队 1—2 人,单人可参赛</li>
            <li>四个固定赛道</li>
            <li>三项轻交付:小实验卡 · 可见结果 · 90秒Demo</li>
            <li>至少 5 个测试案例,须含失败情况</li>
            <li>四维 40 分评分</li>
          </ul>
        </Card>
        <Card title="求证闭环红线">
          <p className="text-[13px] text-slate-600">最小闭环必须是:</p>
          <p className="my-2 rounded bg-slate-50 p-2 text-center text-xs font-medium text-slate-700">
            输入 → 处理 → <span className="text-brand-700">依据明确标准检查</span> → 人工确认 → 输出
          </p>
          <ul className="list-disc space-y-1 pl-4 text-xs leading-5 text-slate-600">
            <li>没有检查环节,不能提交</li>
            <li>关键判断与放行不能全交给AI</li>
            <li>只用公开/模拟/脱敏数据</li>
          </ul>
        </Card>
        <Card title="最新公告">
          <ul className="space-y-3">
            {announcements.map((a) => (
              <li key={a.id} className="text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  {a.pinned && <Badge tone="amber">置顶</Badge>}
                  {a.title}
                </span>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.body}</p>
              </li>
            ))}
            {announcements.length === 0 && <li className="text-sm text-slate-400">暂无公告</li>}
          </ul>
          <Link href="/announcements" className="mt-3 inline-block text-xs text-brand-600 hover:underline">全部公告 →</Link>
        </Card>
      </div>

      <Card title="四个正式赛道">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map((t) => (
            <div key={t.key} className="surface-card surface-card-hover p-4">
              <span className="inline-flex h-7 items-center rounded-md bg-brand-50 px-2 text-xs font-semibold text-brand-700">{t.name}</span>
              <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-slate-500" title={t.description}>{t.description}</p>
              <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-xs leading-5 text-emerald-700">✓ {t.suitable}</p>
              <p className="mt-1 line-clamp-1 text-xs leading-5 text-red-600" title={`不适合:${t.unsuitable}`}>✗ {t.unsuitable}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

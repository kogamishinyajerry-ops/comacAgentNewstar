import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, LinkButton, Badge } from "@/components/ui";
import { TRACKS } from "@/lib/constants";

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
    <div className="space-y-8 py-4">
      <section className="anim-gradient-pan relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-[#3730a3] px-8 py-12 text-white shadow-[0_12px_40px_rgba(79,70,229,0.25)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.14) 0, transparent 45%), radial-gradient(circle at 88% 80%, rgba(255,255,255,0.1) 0, transparent 40%)",
          }}
        />
        <div className="relative max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-200">内部创新活动平台</p>
          <h1 className="mt-2 text-[32px] font-bold leading-tight tracking-tight">{config?.name ?? "青年AI轻创活动"}</h1>
          <p className="mt-3 text-lg text-brand-50">{config?.slogan ?? "发现一个真问题,做一个可验证的解法。"}</p>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-brand-100/90">
            {config?.intro ||
              "不做宏大平台,只做一条从真问题到可验证解法的小实验路径:10步向导、5个测试案例、三项轻交付,四维40分评审。"}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <LinkButton href={user.role === "JUDGE" ? "/judge" : user.role === "ORGANIZER" || user.role === "ADMIN" ? "/organizer" : "/projects"} variant="secondary" size="lg">
                进入工作区
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/register" variant="secondary" size="lg">注册参与</LinkButton>
                <LinkButton href="/login" variant="ghost" size="lg" className="text-white hover:bg-white/10">登录</LinkButton>
              </>
            )}
            <LinkButton href="/?demo=1" variant="ghost" size="lg" className="text-white hover:bg-white/10">▶ 观看自动演示</LinkButton>
            <LinkButton href="/inspirations" variant="ghost" size="lg" className="text-white hover:bg-white/10">看看案例灵感</LinkButton>
          </div>
          {config?.submissionDeadline && (
            <p className="mt-5 text-xs text-brand-200/90">
              活动时间:{config.startDate ?? "?"} — {config.endDate ?? "?"} · 提交截止:{config.submissionDeadline}
            </p>
          )}
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
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

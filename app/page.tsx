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
    <div className="space-y-8 py-6">
      <section className="rounded-xl bg-gradient-to-br from-brand-600 to-brand-700 px-8 py-12 text-white">
        <h1 className="text-3xl font-bold">{config?.name ?? "青年AI轻创活动"}</h1>
        <p className="mt-3 text-lg">{config?.slogan ?? "发现一个真问题,做一个可验证的解法。"}</p>
        <p className="mt-3 max-w-2xl text-sm text-brand-100">
          {config?.intro ||
            "不做宏大平台,只做一条从真问题到可验证解法的小实验路径:10步向导、5个测试案例、三项轻交付,四维40分评审。"}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <LinkButton href={user.role === "JUDGE" ? "/judge" : user.role === "ORGANIZER" || user.role === "ADMIN" ? "/organizer" : "/projects"} variant="secondary">
              进入工作区
            </LinkButton>
          ) : (
            <>
              <LinkButton href="/register" variant="secondary">注册参与</LinkButton>
              <LinkButton href="/login" variant="secondary">登录</LinkButton>
            </>
          )}
          <LinkButton href="/inspirations" variant="ghost" className="text-white hover:bg-white/10">看看案例灵感</LinkButton>
        </div>
        {config?.submissionDeadline && (
          <p className="mt-4 text-xs text-brand-100">
            活动时间:{config.startDate ?? "?"} — {config.endDate ?? "?"} · 提交截止:{config.submissionDeadline}
          </p>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="参赛规则速览">
          <ul className="list-disc space-y-2 pl-4 text-sm text-slate-600">
            <li>每队1—2人,单人可参赛(建议Echo+Delta互补)</li>
            <li>四个固定赛道,不可自选新增</li>
            <li>最终只需三项轻交付:小实验卡、可见结果、90秒成果包</li>
            <li>至少5个测试案例,必须含失败或不适用情况</li>
            <li>四维40分评分:真问题、原创、闭环、证据</li>
          </ul>
        </Card>
        <Card title="求证闭环红线">
          <p className="text-sm text-slate-600">最小闭环必须是:</p>
          <p className="my-2 rounded bg-slate-50 p-2 text-xs font-medium text-slate-700">
            输入 → AI或自动化处理 → 依据明确标准检查 → 人工确认或异常处理 → 输出
          </p>
          <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
            <li>没有检查环节,验证维度为0且不能提交</li>
            <li>不得把关键工程判断、放行与责任全部交给AI</li>
            <li>只允许公开/模拟/自有非敏感/已脱敏数据</li>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TRACKS.map((t) => (
            <div key={t.key} className="rounded-lg border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800">{t.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{t.description}</p>
              <p className="mt-2 text-xs text-emerald-700">适合:{t.suitable}</p>
              <p className="mt-1 text-xs text-red-600">不适合:{t.unsuitable}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

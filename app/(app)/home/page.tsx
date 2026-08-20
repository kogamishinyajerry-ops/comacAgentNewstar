import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Lightbulb, Play, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Card, LinkButton, Badge, cn } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { TRACKS } from "@/lib/constants";
import { DailyInspiration } from "@/components/daily-art";
import { Seal } from "@/components/seal";

/* ---------------- 旅程定位:诚实推导,不伪造进度 ----------------
   节点状态只来自真实数据:队伍成员关系 + 项目 status/currentStep。
   不展示百分比,只表达「已完成 → 当前 → 未开始」的空间叙事。 */

type NodeState = "done" | "current" | "todo";

interface JourneyNode {
  key: string;
  label: string;
  state: NodeState;
  detail?: string;
  tone?: "default" | "warn";
}

const CLOSED = ["SUBMITTED", "PRELIMINARY", "FINAL", "ARCHIVED"];

function buildJourney(opts: {
  loggedIn: boolean;
  hasTeam: boolean;
  project: { status: string; currentStep: number } | null;
}): JourneyNode[] {
  const { loggedIn, hasTeam, project } = opts;
  const submitted = !!project && CLOSED.includes(project.status);
  const inReview = !!project && ["PRELIMINARY", "FINAL"].includes(project.status);
  const archived = project?.status === "ARCHIVED";

  const s = (done: boolean, current: boolean): NodeState => (done ? "done" : current ? "current" : "todo");

  return [
    {
      key: "team",
      label: "组队开题",
      state: s(hasTeam, loggedIn && !hasTeam),
      detail: hasTeam ? "已组队" : loggedIn ? "创建或加入一支小队" : undefined,
    },
    {
      key: "wizard",
      label: "十步向导",
      state: s(submitted, loggedIn && hasTeam && !submitted),
      detail:
        project?.status === "RETURNED"
          ? "评审退回 · 待修改后重新提交"
          : project && !submitted
            ? `进行至第 ${project.currentStep} 步`
            : hasTeam && !project
              ? "从一个真问题开题"
              : undefined,
      tone: project?.status === "RETURNED" ? "warn" : "default",
    },
    {
      key: "deliver",
      label: "三项轻交付",
      state: s(inReview || archived, project?.status === "SUBMITTED"),
      detail: project?.status === "SUBMITTED" ? "已提交 · 等待评审" : undefined,
    },
    {
      key: "review",
      label: "四维评审",
      state: s(archived, inReview),
      detail:
        project?.status === "PRELIMINARY"
          ? "初审入围"
          : project?.status === "FINAL"
            ? "决赛答辩"
            : archived
              ? "已归档"
              : undefined,
    },
  ];
}

function JourneyStrip({ nodes, loggedIn }: { nodes: JourneyNode[]; loggedIn: boolean }) {
  return (
    <section aria-labelledby="journey-title" className="surface-card px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="kicker">Journey</p>
          <h2 id="journey-title" className="font-display mt-1.5 text-display-lg text-ink-900">
            {loggedIn ? "你的旅程" : "活动路径"}
          </h2>
        </div>
        <p className="text-caption text-ink-500">
          {loggedIn ? "只标记真实状态,不展示伪造的完成度。" : "四步走完一个小实验闭环,登录后这里会标记你的位置。"}
        </p>
      </div>
      <ol className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {nodes.map((n, i) => (
          <li
            key={n.key}
            aria-current={n.state === "current" ? "step" : undefined}
            className={cn(
              "relative border-t-2 pt-4",
              n.state === "done" && "border-brand-400",
              n.state === "current" && "border-brand-600",
              n.state === "todo" && "border-ink-900/10"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute -top-[5px] left-0 h-2 w-2 rounded-full",
                n.state === "done" && "bg-brand-500",
                n.state === "current" && "bg-brand-600 ring-4 ring-brand-500/15",
                n.state === "todo" && "bg-ink-200"
              )}
            />
            <div className="flex items-baseline justify-between gap-2">
              <span className="tnum text-micro font-semibold text-ink-400">{String(i + 1).padStart(2, "0")}</span>
              {n.state === "done" && (
                <span className="flex items-center gap-1 text-micro font-semibold text-brand-600">
                  <Check size={11} strokeWidth={3} aria-hidden />
                  已完成
                </span>
              )}
              {n.state === "current" && (
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-micro font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/20">
                  当前位置
                </span>
              )}
            </div>
            <p
              className={cn(
                "font-display mt-1.5 text-[17px] font-bold tracking-tight",
                n.state === "todo" ? "text-ink-400" : "text-ink-900"
              )}
            >
              {n.label}
            </p>
            {n.detail && (
              <p className={cn("mt-1 text-caption", n.tone === "warn" ? "text-amber-700" : "text-ink-500")}>
                {n.detail}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ---------------- 页面 ---------------- */

export default async function HomePage() {
  const [config, user] = await Promise.all([
    prisma.activityConfig.findUnique({ where: { id: "main" } }),
    getCurrentUser(),
  ]);
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 3,
  });

  // 旅程定位:仅参赛者需要个人状态;评委/组织者走自己的工作台
  let hasTeam = false;
  let activeProject: { status: string; currentStep: number } | null = null;
  if (user?.role === "PARTICIPANT") {
    const membership = await prisma.teamMember.findFirst({
      where: { userId: user.id },
      select: { teamId: true },
    });
    hasTeam = !!membership;
    if (membership) {
      const projects = await prisma.ideaProject.findMany({
        where: { teamId: membership.teamId },
        orderBy: { updatedAt: "desc" },
        select: { status: true, currentStep: true },
      });
      activeProject =
        projects.find((p) => !CLOSED.includes(p.status)) ?? projects[0] ?? null;
    }
  }
  const journey = buildJourney({ loggedIn: !!user, hasTeam, project: activeProject });

  return (
    <div className="space-y-10 py-6">
      {/* 已登录用户:旅程定位提到 hero 之前,先给位置再给叙事 */}
      {user && (
        <Reveal>
          <JourneyStrip nodes={journey} loggedIn />
        </Reveal>
      )}

      {/* 编辑风主视觉:纸墨 + 朱砂印章 + 刻线 */}
      <Reveal>
        <section className="tick-corners relative overflow-hidden rounded-lg border border-ink-900/10 bg-[#fffdf8] px-6 py-12 sm:px-10 lg:px-14 lg:py-16">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div className="max-w-2xl">
              {/* 移动端收窄字距防折行 */}
              <p className="kicker !tracking-[0.16em] [text-wrap:balance] sm:!tracking-[0.28em]">Internal Innovation Program · 2026</p>
              <h1 className="font-display mt-5 text-display-xl text-ink-900">
                发现一个真问题,
                <br />
                做一个<span className="relative mx-1 inline-block text-brand-600">
                  可验证
                  <svg className="absolute -bottom-1.5 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden>
                    <path d="M2 5 C 60 1, 140 8, 198 3" stroke="#b94a26" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.7" />
                  </svg>
                </span>的解法。
              </h1>
              <p className="mt-6 max-w-xl text-lead text-ink-500">
                {config?.intro ||
                  "不做宏大平台,只做一条从真问题到可验证解法的小实验路径:10步向导、5个测试案例、三项轻交付,四维40分评审。"}
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                {user ? (
                  <LinkButton href={user.role === "JUDGE" ? "/judge" : user.role === "ORGANIZER" || user.role === "ADMIN" ? "/organizer" : "/projects"} size="lg">
                    进入工作台
                    <ArrowRight size={16} aria-hidden />
                  </LinkButton>
                ) : (
                  <>
                    <LinkButton href="/register" size="lg">注册参与</LinkButton>
                    <LinkButton href="/login" variant="secondary" size="lg">登录</LinkButton>
                  </>
                )}
                <LinkButton href="/home?demo=1" variant="ghost" size="lg" className="text-ink-500">
                  <Play size={14} aria-hidden />
                  观看自动演示
                </LinkButton>
                <LinkButton href="/inspirations" variant="ghost" size="lg" className="text-ink-500">
                  <Lightbulb size={14} aria-hidden />
                  案例灵感
                </LinkButton>
              </div>
              {config?.submissionDeadline && (
                <p className="mt-7 flex items-center gap-2 text-caption tracking-wide text-ink-500">
                  <span className="inline-block h-3 w-[3px] bg-brand-500" aria-hidden />
                  {config.startDate ?? "?"} — {config.endDate ?? "?"} · 提交截止 {config.submissionDeadline}
                </p>
              )}
            </div>
            {/* 印章主视觉 */}
            <div className="relative hidden lg:block" aria-hidden>
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
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-ink-900/10 bg-ink-900/10 sm:grid-cols-4">
            {[
              ["10", "步引导流程"],
              ["5", "例测试要求"],
              ["3", "项轻交付"],
              ["40", "分四维评审"],
            ].map(([n, l]) => (
              <div key={l} className="flex items-baseline gap-2.5 bg-[#fffdf8] px-4 py-3.5">
                <span className="font-display tnum text-2xl font-bold text-brand-600">{n}</span>
                <span className="text-caption text-ink-500">{l}</span>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* 旅程定位:匿名用户保持 hero 之后的原位置 */}
      {!user && (
        <Reveal delayMs={80}>
          <JourneyStrip nodes={journey} loggedIn={false} />
        </Reveal>
      )}

      <Reveal delayMs={140}>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DailyInspiration />
          <Card title="参赛规则速览">
            <ol className="divide-y divide-ink-900/10">
              {[
                "每队 1—2 人,单人可参赛",
                "四个固定赛道",
                "三项轻交付:小实验卡 · 可见结果 · 90秒Demo",
                "至少 5 个测试案例,须含失败情况",
                "四维 40 分评分",
              ].map((rule, i) => (
                <li key={rule} className="flex items-baseline gap-2.5 py-2 first:pt-0 last:pb-0">
                  <span className="tnum text-micro font-semibold text-brand-600">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-caption leading-5 text-ink-600">{rule}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card title="求证闭环红线">
            <p className="text-caption text-ink-500">最小闭环必须是:</p>
            <p className="my-2.5 flex flex-wrap items-center gap-y-1 rounded-md border border-ink-900/10 bg-ink-50 px-2.5 py-2 text-micro font-medium text-ink-600">
              输入
              <ChevronRight size={11} className="text-ink-300" aria-hidden />
              处理
              <ChevronRight size={11} className="text-ink-300" aria-hidden />
              <span className="font-semibold text-brand-700">依据明确标准检查</span>
              <ChevronRight size={11} className="text-ink-300" aria-hidden />
              人工确认
              <ChevronRight size={11} className="text-ink-300" aria-hidden />
              输出
            </p>
            <ul className="divide-y divide-ink-900/10">
              {["没有检查环节,不能提交", "关键判断与放行不能全交给AI", "只用公开/模拟/脱敏数据"].map((r) => (
                <li key={r} className="flex items-baseline gap-2 py-1.5 text-caption leading-5 text-ink-600">
                  <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-brand-500" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="最新公告">
            <ul className="space-y-3.5">
              {announcements.map((a) => (
                <li key={a.id}>
                  <span className="flex items-center gap-2 text-[13px] font-semibold leading-5 text-ink-800">
                    {a.pinned && <Badge tone="amber">置顶</Badge>}
                    {a.title}
                  </span>
                  <p className="mt-1 line-clamp-2 text-caption text-ink-500">{a.body}</p>
                </li>
              ))}
              {announcements.length === 0 && <li className="text-caption text-ink-400">暂无公告</li>}
            </ul>
            <Link href="/announcements" className="group mt-4 inline-flex items-center gap-1 text-caption font-medium text-brand-600 hover:text-brand-700">
              全部公告
              <ArrowRight size={12} className="transition-transform duration-150 ease-soft group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </Card>
        </div>
      </Reveal>

      <Reveal delayMs={180}>
        <section aria-labelledby="tracks-title">
          <div className="mb-5">
            <p className="kicker">Tracks</p>
            <h2 id="tracks-title" className="font-display mt-1.5 text-display-lg text-ink-900">四个正式赛道</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((t, i) => (
              <div key={t.key} className="surface-card surface-card-hover flex flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-7 items-center rounded-md bg-brand-50 px-2 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15">{t.name}</span>
                  <span className="tnum text-micro font-semibold text-ink-300">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <p className="mt-3 text-caption leading-5 text-ink-500">{t.description}</p>
                <div className="mt-3 space-y-1.5 border-t border-ink-900/10 pt-3">
                  <p className="flex items-start gap-1.5 text-caption leading-5 text-ink-600">
                    <Check size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden />
                    {t.suitable}
                  </p>
                  <p className="flex items-start gap-1.5 text-caption leading-5 text-ink-600">
                    <X size={13} strokeWidth={2.5} className="mt-0.5 shrink-0 text-red-600" aria-hidden />
                    {t.unsuitable}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, EmptyState, LinkButton, StatusBadge } from "@/components/ui";
import { TRACKS } from "@/lib/constants";
import { NewProjectButton } from "./new-project-button";

export default async function ProjectsPage() {
  const user = await requireUser();
  const membership = await prisma.teamMember.findFirst({
    where: { userId: user.id },
    include: { team: { include: { members: true } } },
  });
  const projects = membership
    ? await prisma.ideaProject.findMany({
        where: { teamId: membership.teamId },
        orderBy: { updatedAt: "desc" },
        include: { testCases: { select: { verdict: true } } },
      })
    : [];

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">我的想法</h1>
          <p className="mt-1 text-sm text-slate-500">
            {membership ? (
              <>
                队伍:{membership.team.name}({membership.team.members.length}人)
                <span className="ml-2 text-xs">邀请码 <code className="rounded bg-slate-100 px-1.5 py-0.5">{membership.team.inviteCode}</code></span>
              </>
            ) : (
              "还没有队伍,先创建或加入一支队伍"
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!membership && <LinkButton href="/join" variant="secondary">邀请码加入</LinkButton>}
          <NewProjectButton disabled={!membership} />
        </div>
      </div>

      {!membership && (
        <EmptyState
          title="先在第2步创建你的队伍"
          desc="单人可参赛;双人队建议 Echo+Delta 分工。也可以先把邀请码发给搭档。"
          action={<LinkButton href="/projects/new-team">创建队伍</LinkButton>}
        />
      )}

      {membership && projects.length === 0 && (
        <EmptyState title="还没有想法" desc="从一个真实、具体、反复发生的小麻烦开始。" action={<NewProjectButton />} />
      )}

      <div className="grid gap-3">
        {projects.map((p) => {
          const pass = p.testCases.filter((t) => t.verdict === "PASS").length;
          const track = TRACKS.find((t) => t.key === p.track);
          return (
            <Card key={p.id} className="transition hover:border-brand-500">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link href={`/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                    {p.title}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <StatusBadge status={p.status} />
                    <span>{track?.name ?? "未选赛道"}</span>
                    <span>进行到第{p.currentStep}步</span>
                    <span>测试{p.testCases.length}例(通过{pass})</span>
                    <span>更新于{new Date(p.updatedAt).toLocaleString("zh-CN")}</span>
                  </p>
                </div>
                <LinkButton href={`/projects/${p.id}`} variant="secondary" size="sm">继续 →</LinkButton>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

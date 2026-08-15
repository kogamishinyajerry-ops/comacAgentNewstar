import { prisma } from "@/lib/db";
import { apiUser, audit, jsonError } from "@/lib/auth";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

export async function GET(req: Request) {
  const user = await apiUser();
  if (!user) return jsonError(401, "请先登录");
  if (user.role !== "ORGANIZER" && user.role !== "ADMIN") return jsonError(403, "仅组织者可导出");
  const type = new URL(req.url).searchParams.get("type") ?? "projects";

  if (type === "scores") {
    const reviews = await prisma.review.findMany({
      include: {
        assignment: {
          include: {
            project: { include: { team: { include: { members: { include: { user: true } } } } } },
            judge: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
    const csv = toCsv(
      ["作品", "队伍", "成员", "轮次", "评委", "真问题与需求定义", "原创过程与独立完成", "跑通闭环与人机边界", "验证证据与复盘", "总分", "最大价值", "首要改进", "状态"],
      reviews.map((r) => [
        r.assignment.project.title,
        r.assignment.project.team.name,
        r.assignment.project.team.members.map((m) => m.user.name).join("+"),
        r.assignment.round === "PRELIMINARY" ? "预赛" : "决赛",
        r.assignment.judge.name,
        r.problemDefinition,
        r.originality,
        r.closedLoop,
        r.evidence,
        r.problemDefinition + r.originality + r.closedLoop + r.evidence,
        r.bestValue,
        r.topImprovement,
        r.status === "LOCKED" ? "已锁定" : "草稿",
      ])
    );
    await audit(user, "export.scores", "System", "-", `${reviews.length}条`);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scores-${Date.now()}.csv"`,
      },
    });
  }

  const projects = await prisma.ideaProject.findMany({
    include: { team: { include: { members: { include: { user: true } } } }, testCases: true },
    orderBy: { updatedAt: "desc" },
  });
  const statusLabel: Record<string, string> = {
    DRAFT: "草稿", SUBMITTED: "已提交", RETURNED: "退回补充", PRELIMINARY: "预赛", FINAL: "决赛", ARCHIVED: "已归档",
  };
  const csv = toCsv(
    ["作品", "队伍", "成员", "状态", "进行到步骤", "测试案例数", "通过数", "提交时间", "最近更新"],
    projects.map((p) => [
      p.title,
      p.team.name,
      p.team.members.map((m) => m.user.name).join("+"),
      statusLabel[p.status] ?? p.status,
      p.currentStep,
      p.testCases.length,
      p.testCases.filter((t) => t.verdict === "PASS").length,
      p.submittedAt ? new Date(p.submittedAt).toLocaleString("zh-CN") : "",
      new Date(p.updatedAt).toLocaleString("zh-CN"),
    ])
  );
  await audit(user, "export.projects", "System", "-", `${projects.length}条`);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${Date.now()}.csv"`,
    },
  });
}

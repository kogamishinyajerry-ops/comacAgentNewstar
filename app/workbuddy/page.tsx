import { requireRole } from "@/lib/auth";
import { isMockEnabled } from "@/lib/llm/provider";
import { PageHeader, LinkButton, Badge } from "@/components/ui";
import { ControlRail, WorkBuddyConsole } from "@/components/workbuddy-console";

export const metadata = { title: "WorkBuddy 总控 · 青年AI轻创导航站" };

export default async function WorkBuddyPage() {
  await requireRole("ORGANIZER", "ADMIN");

  return (
    <div className="py-2">
      <PageHeader
        title="WorkBuddy 总控台"
        desc="对话即控制:查询直接执行,敏感操作生成确认单、经人工批准后按冻结参数执行;全程事件留痕。"
        actions={
          <>
            <Badge tone="indigo">Activity Control API</Badge>
            <LinkButton href="/integrations" variant="secondary" size="sm">
              MCP 接入
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <WorkBuddyConsole mockMode={isMockEnabled()} />
        <ControlRail />
      </div>
    </div>
  );
}

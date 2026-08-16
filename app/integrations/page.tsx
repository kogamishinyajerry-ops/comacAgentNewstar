import { headers } from "next/headers";
import { requireRole } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui";
import { TokenManager } from "@/components/token-manager";

export const metadata = { title: "MCP 接入 · 青年AI轻创导航站" };

export default async function IntegrationsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/mcp`;

  return (
    <div className="mx-auto max-w-3xl py-2">
      <PageHeader
        title="MCP 接入"
        desc="把活动控制能力开放给你的 Agent 客户端:工具目录即 Activity Control 动作注册表,敏感工具一律走人工确认。"
        actions={<Badge tone="indigo">MCP · Streamable HTTP</Badge>}
      />
      <TokenManager endpoint={endpoint} />
    </div>
  );
}

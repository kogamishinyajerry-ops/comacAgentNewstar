import { headers } from "next/headers";
import { KeyRound, Plug, ShieldCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { Badge } from "@/components/ui";
import { Reveal } from "@/components/fx";
import { TokenManager } from "@/components/token-manager";

export const metadata = { title: "MCP 接入 · 青年AI轻创导航站" };

export default async function IntegrationsPage() {
  await requireRole("ORGANIZER", "ADMIN");
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const endpoint = `${proto}://${host}/api/mcp`;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <Reveal>
        <header className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="kicker">Activity Control</p>
            <Badge tone="indigo">MCP · Streamable HTTP</Badge>
          </div>
          <h1 className="font-display mt-2 text-display-lg text-ink-900">MCP 接入</h1>
          <p className="mt-2 max-w-xl text-lead text-ink-500">
            把活动控制能力开放给你的 Agent 客户端:工具目录即 Activity Control 动作注册表,敏感工具一律走人工确认。
          </p>
        </header>
      </Reveal>

      <Reveal delayMs={80}>
        <ol aria-label="接入路径" className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { icon: KeyRound, step: "01", title: "创建令牌", desc: "明文只展示一次,请立即复制保存。" },
            { icon: Plug, step: "02", title: "配置客户端", desc: "在 Agent 客户端填入端点与令牌。" },
            { icon: ShieldCheck, step: "03", title: "人工确认放行", desc: "敏感动作生成待确认项,由人签发放行。" },
          ].map((s) => (
            <li key={s.step} className="surface-card p-4">
              <div className="flex items-center justify-between">
                <s.icon size={16} className="text-brand-600" aria-hidden />
                <span className="tnum text-micro font-semibold text-ink-300">{s.step}</span>
              </div>
              <p className="font-display mt-2.5 text-[15px] font-bold tracking-tight text-ink-900">{s.title}</p>
              <p className="mt-1 text-caption leading-5 text-ink-500">{s.desc}</p>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delayMs={140}>
        <TokenManager endpoint={endpoint} />
      </Reveal>
    </div>
  );
}

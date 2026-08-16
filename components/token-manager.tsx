"use client";

// MCP 令牌管理:创建(明文仅展示一次)/吊销
import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "./ui";

interface TokenView {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function TokenManager({ endpoint }: { endpoint: string }) {
  const [tokens, setTokens] = useState<TokenView[]>([]);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ plain: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/mcp/tokens").then((x) => x.json() as Promise<{ tokens?: TokenView[] }>);
    setTokens(r.tokens ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/mcp/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      }).then((x) => x.json() as Promise<{ plain?: string; token?: TokenView }>);
      if (r.plain) {
        setFresh({ plain: r.plain, name: name.trim() });
        setCopied(false);
        setName("");
        await load();
      }
    } finally {
      setBusy(false);
    }
  }, [name, busy, load]);

  const revoke = useCallback(
    async (id: string) => {
      await fetch(`/api/mcp/tokens/${id}`, { method: "DELETE" });
      await load();
    },
    [load]
  );

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="surface-card px-4 py-3.5">
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="mb-1.5 block text-[13px] font-medium text-slate-700">令牌名称</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:我的桌面 Agent、CI 巡检"
              maxLength={40}
              className="h-9 w-full rounded-md border border-ink-900/20 bg-[#fffdf8] px-3 text-[13px] text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none"
            />
          </label>
          <Button onClick={() => void create()} disabled={busy || !name.trim()}>
            创建令牌
          </Button>
        </div>

        {fresh && (
          <div className="mt-3 rounded-lg border border-brand-300/70 bg-brand-50/50 p-3">
            <p className="text-[13px] font-medium text-brand-800">
              「{fresh.name}」已创建——明文只显示这一次,请立即复制保存:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-white px-2.5 py-1.5 font-mono text-xs text-ink-800 ring-1 ring-ink-900/10">{fresh.plain}</code>
              <Button size="sm" variant="secondary" onClick={() => void copy(fresh.plain)}>
                {copied ? "已复制" : "复制"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="surface-card">
        <header className="flex min-h-[46px] items-center justify-between border-b border-ink-900/10 px-4 py-2.5">
          <h2 className="font-display text-[13px] font-bold tracking-wide text-ink-900">我的令牌</h2>
          <span className="text-[11px] text-ink-400">只存哈希,明文不可找回</span>
        </header>
        <ul className="divide-y divide-ink-900/5 px-4">
          {tokens.length === 0 && <li className="py-6 text-center text-xs text-ink-300">还没有令牌。</li>}
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[13px] font-medium text-ink-900">
                  {t.name}
                  {t.revokedAt ? <Badge tone="gray">已吊销</Badge> : <Badge tone="green">有效</Badge>}
                </p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-ink-400">
                  <code className="font-mono">{t.prefix}…</code>
                  <span>创建:{new Date(t.createdAt).toLocaleString("zh-CN")}</span>
                  {t.lastUsedAt && <span>最近使用:{new Date(t.lastUsedAt).toLocaleString("zh-CN")}</span>}
                </p>
              </div>
              {!t.revokedAt && (
                <Button size="xs" variant="secondary" onClick={() => void revoke(t.id)}>
                  吊销
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="surface-card px-4 py-3.5">
        <h2 className="font-display text-[13px] font-bold tracking-wide text-ink-900">接入方式(MCP 客户端)</h2>
        <p className="mt-1.5 text-xs leading-5 text-ink-500">
          Streamable HTTP 传输(JSON-RPC 2.0 over POST),协议版本 2025-03-26。SAFE 工具(如 activity.overview)直接返回结果;
          SENSITIVE 工具返回 <code className="rounded bg-ink-50 px-1 font-mono text-[10px]">structuredContent.needsConfirmation=true</code>,
          由组织者在 <code className="rounded bg-ink-50 px-1 font-mono text-[10px]">/workbuddy</code> 批准后生效。
        </p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink-900 p-3 font-mono text-[11px] leading-5 text-paper/90">{`{
  "mcpServers": {
    "ynav-activity-control": {
      "type": "http",
      "url": "${endpoint}",
      "headers": { "Authorization": "Bearer <你的令牌>" }
    }
  }
}`}</pre>
      </div>
    </div>
  );
}

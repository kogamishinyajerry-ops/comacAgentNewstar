"use client";

// WorkBuddy 总控控制台:左侧对话,右侧待确认队列 + 事件流
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Receipt, Send } from "lucide-react";
import { Badge, Button, Input, Textarea, cn } from "./ui";

interface Msg {
  role: "user" | "agent";
  content: string;
  toolRuns?: { action: string; ok: boolean; needsConfirmation?: boolean; confirmationId?: string; summary?: string; error?: string }[];
  at?: string;
}

interface PendingItem {
  id: string;
  actionId: string;
  summary: string;
  requestedName: string;
  input: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

interface EventItem {
  id: string;
  seq: number;
  type: string;
  payload: Record<string, unknown>;
  actorName: string;
  createdAt: string;
}

const RAIL_REFRESH = "workbuddy:refresh-rail";

/** 等待反馈:三点脉冲(reduced-motion 下由全局停用,静态圆点仍成立) */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1 w-1 rounded-full bg-current motion-safe:animate-pulse-soft" style={{ animationDelay: `${i * 0.24}s` }} />
      ))}
    </span>
  );
}

export function WorkBuddyConsole({ mockMode }: { mockMode: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "agent",
      content: "我是 WorkBuddy,活动总控。可以直接让我看概览、查事件、发公告、改配置、催办项目——敏感操作会生成确认单,由你批准后执行。输入「帮助」查看全部能力。",
      at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    const next: Msg[] = [...messages, { role: "user", content: text, at: new Date().toISOString() }];
    setMessages(next);
    try {
      const res = await fetch("/api/workbuddy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-14).map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = (await res.json()) as { ok?: boolean; reply?: string; toolRuns?: Msg["toolRuns"]; error?: string };
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.reply || data.error || "(空回复)",
          toolRuns: data.toolRuns,
          at: new Date().toISOString(),
        },
      ]);
      window.dispatchEvent(new Event(RAIL_REFRESH));
    } catch {
      setMessages((prev) => [...prev, { role: "agent", content: "网络错误,请重试。", at: new Date().toISOString() }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages]);

  return (
    <div className="surface-card flex h-[calc(100vh-13rem)] min-h-[480px] flex-col">
      <header className="flex min-h-[46px] items-center justify-between gap-3 border-b border-ink-900/10 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-ink-700 to-ink-900 font-display text-[13px] font-bold text-paper shadow-[0_1px_2px_rgba(28,25,23,0.3),inset_0_1px_0_rgba(255,255,255,0.12)]">
            伙
          </span>
          <h2 className="truncate font-display text-[13px] font-bold tracking-wide text-ink-900">WorkBuddy 总控对话</h2>
          <Badge tone={mockMode ? "amber" : "green"}>{mockMode ? "离线大脑" : "GLM"}</Badge>
        </div>
        <span className="hidden shrink-0 items-center gap-0.5 text-[10px] font-medium tracking-wide text-ink-400 sm:flex">
          敏感操作
          <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          确认单
          <ChevronRight className="h-3 w-3" strokeWidth={2} aria-hidden />
          人工批准
        </span>
      </header>

      <div ref={listRef} role="log" aria-live="polite" aria-label="WorkBuddy 对话记录" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={cn(
                "max-w-[86%] rounded-lg border px-3.5 py-2.5 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "border-transparent bg-ink-900 text-paper shadow-[0_1px_2px_rgba(28,25,23,0.2),0_6px_14px_-8px_rgba(28,25,23,0.35)]"
                  : "border-ink-900/10 bg-[#fffdf8] text-ink-900 shadow-[0_1px_2px_rgba(28,25,23,0.05)]"
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.content}</p>
              {m.toolRuns && m.toolRuns.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-t border-current/10 pt-2">
                  {m.toolRuns.map((t, j) => (
                    <li key={j} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className={cn("tnum rounded px-1.5 py-0.5 font-mono", m.role === "user" ? "bg-white/15" : "bg-ink-900/5 text-ink-600")}>{t.action}</span>
                      {t.error ? (
                        <Badge tone="red">失败:{t.error.slice(0, 60)}</Badge>
                      ) : t.needsConfirmation ? (
                        <Badge tone="amber">
                          <Receipt className="h-3 w-3" strokeWidth={2} aria-hidden />
                          待确认:{t.summary?.slice(0, 46)}
                        </Badge>
                      ) : (
                        <Badge tone="green">
                          <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                          已执行
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div role="status" className="flex items-center gap-2 rounded-lg border border-ink-900/10 bg-[#fffdf8] px-3.5 py-2.5 text-[13px] text-ink-400">
              WorkBuddy 处理中
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-ink-900/10 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={'例如:"看下活动概览" "发一条公告《中期提醒》内容:周五截止前完成第8步测试" (⌘/Ctrl+Enter 发送)'}
            className="min-h-[52px] flex-1"
            rows={2}
          />
          <Button onClick={() => void send()} disabled={!input.trim()} loading={busy}>
            <Send className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            发送
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ControlRail() {
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [p, e] = await Promise.all([
        fetch("/api/confirmations").then((r) => r.json() as Promise<{ confirmations?: PendingItem[] }>),
        fetch("/api/events?limit=14").then((r) => r.json() as Promise<{ events?: EventItem[] }>),
      ]);
      setPending(p.confirmations ?? []);
      setEvents(e.events ?? []);
    } catch {
      /* 静默 */
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener(RAIL_REFRESH, onRefresh);
    const timer = setInterval(onRefresh, 30_000);
    return () => {
      window.removeEventListener(RAIL_REFRESH, onRefresh);
      clearInterval(timer);
    };
  }, [load]);

  const resolve = useCallback(
    async (id: string, decision: "approve" | "deny") => {
      setResolving(id);
      try {
        await fetch(`/api/confirmations/${id}/resolve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note: notes[id] || undefined }),
        });
        await load();
      } finally {
        setResolving(null);
      }
    },
    [notes, load]
  );

  return (
    <div className="space-y-5">
      <section className="surface-card">
        <header className="flex min-h-[46px] items-center justify-between border-b border-ink-900/10 px-4 py-2.5">
          <h2 className="font-display text-[13px] font-bold tracking-wide text-ink-900">待确认敏感操作</h2>
          <Badge tone={pending.length ? "amber" : "gray"}>
            <span className="tnum">{pending.length}</span>
          </Badge>
        </header>
        <div className="max-h-[380px] space-y-2.5 overflow-y-auto px-4 py-3">
          {pending.length === 0 && (
            <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-ink-300/70 bg-ink-50/40 px-4 py-5 text-center">
              <p className="text-xs font-medium text-ink-500">队列为空</p>
              <p className="text-[11px] leading-4 text-ink-400">WorkBuddy/MCP 发起的敏感操作会出现在这里。</p>
            </div>
          )}
          {pending.map((p) => (
            <article key={p.id} className="rounded-lg border border-amber-300/50 bg-amber-50/40 p-3 shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
              <p className="text-[13px] font-medium leading-5 text-ink-900">{p.summary}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-400">
                <span className="tnum font-mono">{p.actionId}</span>
                <span>· 发起:{p.requestedName}</span>
                <span className="tnum">· {new Date(p.createdAt).toLocaleString("zh-CN")}</span>
              </p>
              <details className="group mt-1.5">
                <summary className="flex w-fit cursor-pointer select-none items-center gap-1 rounded text-[11px] font-medium text-ink-400 transition-colors hover:text-ink-700 [&::-webkit-details-marker]:hidden">
                  <ChevronRight className="h-3 w-3 transition-transform duration-150 group-open:rotate-90" strokeWidth={2} aria-hidden />
                  冻结参数
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-white/70 p-2 font-mono text-[10px] leading-4 text-ink-500 ring-1 ring-inset ring-ink-900/10">{p.input}</pre>
              </details>
              <Input
                value={notes[p.id] ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                placeholder="备注(可选):批准/拒绝理由"
                aria-label="批准或拒绝的备注"
                className="mt-2 h-7 text-xs"
              />
              <div className="mt-2 flex gap-2">
                <Button size="xs" onClick={() => void resolve(p.id, "approve")} disabled={resolving === p.id} loading={resolving === p.id}>
                  批准并执行
                </Button>
                <Button size="xs" variant="secondary" onClick={() => void resolve(p.id, "deny")} disabled={resolving === p.id}>
                  拒绝
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <header className="flex min-h-[46px] items-center justify-between border-b border-ink-900/10 px-4 py-2.5">
          <h2 className="font-display text-[13px] font-bold tracking-wide text-ink-900">事件中心</h2>
          <span className="text-[11px] text-ink-400">
            <span className="tnum">30</span>s 自动刷新
          </span>
        </header>
        <ul className="max-h-[320px] space-y-1 overflow-y-auto px-4 py-3 text-[11px]">
          {events.length === 0 && <li className="py-3 text-center text-ink-400">暂无事件。</li>}
          {events.map((e) => (
            <li key={e.id ?? e.seq} className="flex items-baseline gap-2 border-b border-ink-900/5 py-1 last:border-0">
              <span className="tnum shrink-0 font-mono text-ink-300">#{e.seq}</span>
              <span className="min-w-0 flex-1">
                <span className="font-mono text-[10px] text-brand-700">{e.type}</span>
                {typeof e.payload.summary === "string" && <span className="ml-1 text-ink-500">{e.payload.summary.slice(0, 44)}</span>}
                <span className="ml-1 text-ink-400">· {e.actorName}</span>
              </span>
              <span className="tnum shrink-0 text-ink-400">{new Date(e.createdAt).toLocaleTimeString("zh-CN", { hour12: false })}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

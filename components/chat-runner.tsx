"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getStepConfig } from "@/lib/steps";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { Badge, Button, ProgressBar, ProgressRing, StatusBadge, cn } from "./ui";
import { Seal } from "./seal";
import { MissionBar } from "./charts";
import { LevelBadge, XpBar } from "./achievements";
import { CHAT_OPENING } from "@/lib/llm/chat-brain";
import { showToast } from "./fx";

export interface ChatMsg {
  id: string;
  role: string;
  content: string;
  meta: {
    updates?: { step: number; key: string; value: string | boolean }[];
    nextTarget?: { step: number; key: string; label?: string } | null;
    action?: string | null;
    grill?: { q: string; why?: string } | null;
  };
  createdAt: string;
}

export interface ChatBoot {
  projectId: string;
  title: string;
  status: string;
  readOnly: boolean;
  progress: {
    overallPct: number;
    closedLoopOk: boolean;
    tests: { count: number; passOk: boolean; coverageOk: boolean };
    nextHint: string;
    currentStep: number;
  };
}

const TEAM_LABEL: Record<string, string> = {
  startTime: "实际开始时间",
  existingBase: "活动前已有基础",
  addedDuringActivity: "活动期间新增",
  externalResources: "外部资源",
  helpers: "帮助人员",
};

function fieldLabel(step: number, key: string): string {
  if (step === 2) return TEAM_LABEL[key] ?? key;
  if (step === 3) return "赛道";
  if (step === 1) return "活动承诺";
  return getStepConfig(step)?.fields.find((f) => f.key === key)?.label.split("(")[0].slice(0, 12) ?? key;
}

export function ChatRunner({ boot, initialMessages }: { boot: ChatBoot; initialMessages: ChatMsg[] }) {
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(boot.progress);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy || boot.readOnly) return;
    setInput("");
    setBusy(true);
    // 乐观插入用户消息
    const optimistic: ChatMsg = { id: `tmp-${Date.now()}`, role: "user", content: text, meta: {}, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch(`/api/projects/${boot.projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast({ tone: "error", icon: "⚠️", title: "发送失败", desc: json.error ?? "请重试" });
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(text);
        return;
      }
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), json.user, json.agent]);
      if (json.progress) setProgress(json.progress);
      const upd = json.agent?.meta?.updates ?? [];
      if (upd.length) {
        showToast({ tone: "success", icon: "✓", title: `已记录 ${upd.length} 项材料`, desc: upd.map((u: { step: number; key: string }) => fieldLabel(u.step, u.key)).join("、"), durationMs: 2800 });
      }
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  }

  const showOpening = messages.length === 0;

  return (
    <div className="grid gap-4 py-2 lg:grid-cols-[minmax(0,1fr)_272px]">
      {/* 对话主栏 */}
      <div className="tick-corners surface-card flex h-[calc(100vh-11rem)] min-h-[480px] flex-col overflow-hidden">
        {/* 头部 */}
        <header className="flex items-center justify-between gap-2 border-b border-ink-900/10 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <Seal size={26} char="问" tilt />
            <div className="min-w-0">
              <p className="font-display truncate text-[14px] font-bold leading-tight text-ink-900">{boot.title}</p>
              <p className="text-[10px] tracking-wide text-ink-400">对话式工作台 · 说出来,我帮你整理成材料</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={boot.status} />
            <Link
              href={`/projects/${boot.projectId}?step=${progress.currentStep}`}
              className="rounded border border-ink-900/15 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-ink-900/35"
              title="查看/编辑结构化材料"
            >
              结构视图
            </Link>
          </div>
        </header>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {showOpening && (
            <div className="mx-auto max-w-md rounded-lg border border-ink-900/10 bg-paper p-5">
              <div className="mb-2 flex items-center gap-2">
                <Seal size={22} char="问" />
                <span className="font-display text-xs tracking-widest text-ink-400">AGENT · 面试官</span>
              </div>
              <p className="whitespace-pre-line font-display text-[14px] leading-7 text-ink-800">{CHAT_OPENING}</p>
            </div>
          )}
          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[78%] rounded-lg rounded-br-sm bg-ink-900 px-3.5 py-2.5 text-[13px] leading-6 text-paper shadow-sm">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[86%] space-y-2">
                  <div className="rounded-lg rounded-bl-sm border border-ink-900/10 bg-[#fffdf8] px-3.5 py-2.5">
                    <div className="flex items-start gap-2">
                      <Seal size={18} char="问" className="mt-0.5 shrink-0" />
                      <p className="text-[13px] leading-6 text-ink-800">{m.content}</p>
                    </div>
                    {m.meta.grill && (
                      <div className="mt-2 rounded border-l-2 border-brand-500 bg-brand-50/60 px-2.5 py-1.5">
                        <p className="text-[12px] font-medium leading-5 text-brand-800">🔥 {m.meta.grill.q}</p>
                        {m.meta.grill.why && <p className="mt-0.5 text-[10px] leading-4 text-brand-600/80">💡 {m.meta.grill.why}</p>}
                      </div>
                    )}
                    {m.meta.action === "open-structure-8" && (
                      <Link
                        href={`/projects/${boot.projectId}?step=8`}
                        className="mt-2 inline-flex items-center gap-1 rounded border border-ink-900/15 px-2 py-1 text-[11px] font-medium text-ink-700 hover:border-ink-900/40"
                      >
                        去第8步填测试案例 →
                      </Link>
                    )}
                  </div>
                  {m.meta.updates && m.meta.updates.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-1">
                      {m.meta.updates.map((u, i) => (
                        <span
                          key={i}
                          title={typeof u.value === "string" ? u.value : "已确认"}
                          className="anim-pop-in inline-flex max-w-[240px] items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-50/70 px-2 py-0.5 text-[10px] font-medium text-emerald-800"
                        >
                          ✓ {fieldLabel(u.step, u.key)} 已记录
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          {busy && (
            <div className="flex items-center gap-2 pl-1">
              <Seal size={18} char="问" className="anim-glow-pulse" />
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-300" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </span>
            </div>
          )}
        </div>

        {/* 唯一输入入口 */}
        <div className="border-t border-ink-900/10 bg-paper/60 px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              rows={1}
              disabled={boot.readOnly}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target as HTMLTextAreaElement;
                el.style.height = "auto";
                el.style.height = `${Math.min(120, el.scrollHeight)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="用你自己的话说——我在听,也在记录"
              className="max-h-[120px] min-h-[42px] flex-1 resize-none rounded-md border border-ink-900/20 bg-[#fffdf8] px-3 py-2.5 text-[13px] leading-6 text-ink-900 placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50"
            />
            <Button size="lg" disabled={busy || !input.trim() || boot.readOnly} onClick={send} title="Enter 发送">
              <span className="font-display">答</span>
            </Button>
          </div>
          <p className="mt-1.5 pl-1 text-[10px] text-ink-300">Enter 发送 · Shift+Enter 换行 · 每句话都会被整理成材料字段</p>
        </div>
      </div>

      {/* 记分牌 */}
      <aside className="space-y-3">
        <div className="surface-card p-4">
          <div className="flex items-center gap-4">
            <ProgressRing pct={progress.overallPct} size={72} stroke={6} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink-400">整体进度</p>
              <p className="tnum font-display text-xl font-bold text-ink-900">{progress.overallPct}%</p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-ink-400">{progress.nextHint}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <MissionBar
              phases={[
                { label: "真问题", done: progress.currentStep > 4 },
                { label: "闭环", done: progress.closedLoopOk },
                { label: "证据", done: progress.tests.passOk && progress.tests.coverageOk },
                { label: "交付", done: false },
              ]}
            />
          </div>
          <div className="mt-3">
            <ProgressBar pct={progress.overallPct} />
          </div>
        </div>

        <div className="surface-card p-4">
          <LevelBadge pct={progress.overallPct} submitted={false} compact />
          <div className="mt-2.5">
            <XpBar pct={progress.overallPct} submitted={false} />
          </div>
        </div>

        <div className="surface-card space-y-1.5 p-4 text-[12px]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">直达</p>
          {[
            [`/projects/${boot.projectId}?step=8`, "第8步 · 测试案例"],
            [`/projects/${boot.projectId}?step=9`, "第9步 · 提交预检"],
            [`/projects/${boot.projectId}/card`, "小实验卡 · 三件套"],
            [`/projects/${boot.projectId}?step=10`, "状态与插画图鉴"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="flex items-center justify-between rounded px-2 py-1.5 text-ink-600 hover:bg-ink-50 hover:text-ink-900">
              {label}
              <span className="text-ink-300">→</span>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-ink-900/15 p-3 text-[10px] leading-4 text-ink-400">
          <Badge tone="gray">对话即填写</Badge>
          <p className="mt-1.5">你说的话被实时整理成结构化材料;结构视图里随时可改。表单不再是主入口——语言才是。</p>
        </div>
      </aside>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, MessageCircle } from "lucide-react";
import { TEAM_FIELDS } from "@/lib/steps";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { Alert, Badge, Button, Field, Input, Select, Textarea, cn } from "./ui";
import type { WizardData } from "./wizard-types";

export function TeamStep({ data, onSaved }: { data: WizardData; onSaved: () => void }) {
  const [team, setTeam] = useState(data.team);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 累积待保存字段:连续填写多个字段时,一次防抖批量落库(避免只保存最后一份)
  const pendingRef = useRef<Record<string, string>>({});

  const save = useCallback(
    (payload: Record<string, unknown>) => {
      fetch(`/api/teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => {
        if (r.ok) {
          setSaved(true);
          onSaved();
        }
      });
    },
    [team.id, onSaved]
  );

  const update = useCallback(
    (key: string, value: string) => {
      setTeam((prev) => ({ ...prev, [key]: value }));
      pendingRef.current[key] = value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const payload = pendingRef.current;
        pendingRef.current = {};
        save(payload);
      }, 800);
    },
    [save]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const seatLabel: Record<string, string> = { OWNER: "队长", ECHO: "Echo", DELTA: "Delta" };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ink-900/10 bg-ink-50/40 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-[15px] font-bold text-ink-900">{team.name}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <Badge tone={team.members.length >= 2 ? "green" : "gray"}>
                {team.members.length}/2 人
              </Badge>
              <span>{TEAM_MODE_LABELS[team.mode as keyof typeof TEAM_MODE_LABELS] ?? team.mode}</span>
            </p>
          </div>
          {!data.readOnly && team.members.length < 2 && (
            <div className="text-right text-xs text-ink-500">
              <p>邀请码</p>
              <code className="kbd tnum mt-1 text-[13px] tracking-[0.22em]">{team.inviteCode}</code>
              <p className="mt-1">发给搭档,在「邀请码加入」页使用</p>
            </div>
          )}
        </div>
        <ul className="mt-3.5 space-y-1.5 border-t border-ink-900/10 pt-3 text-sm text-ink-600">
          {team.members.map((m, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="font-display flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[11px] font-bold text-paper" aria-hidden>
                {m.name.slice(0, 1)}
              </span>
              {m.name} <span className="text-xs text-ink-400">({seatLabel[m.seatRole] ?? m.seatRole})</span>
            </li>
          ))}
        </ul>
        {!data.readOnly && (
          <div className="mt-3.5">
            <Alert tone="info">
              每队最多2名核心成员。不允许通过「顾问、外围成员、技术支持」等名义变相扩大团队;第三人前后端与数据库都会被阻止。
            </Alert>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-[14px] font-bold text-ink-900">
          原创与公平披露
          <span className="ml-2 font-sans text-xs font-normal text-ink-400">必填,提交前会校验</span>
        </h3>
        {TEAM_FIELDS.map((f) => {
          const filled = String(team[f.key as keyof typeof team] ?? "").trim().length > 0;
          return (
            <div key={f.key} className="relative">
              <Field label={f.label} required={f.required}>
                {f.type === "textarea" ? (
                  <Textarea
                    rows={2}
                    disabled={data.readOnly}
                    placeholder={f.placeholder}
                    className={cn(filled && "border-emerald-300/70 bg-emerald-50/30")}
                    value={String(team[f.key as keyof typeof team] ?? "")}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                ) : (
                  <Input
                    disabled={data.readOnly}
                    placeholder={f.placeholder}
                    className={cn(filled && "border-emerald-300/70 bg-emerald-50/30")}
                    value={String(team[f.key as keyof typeof team] ?? "")}
                    onChange={(e) => update(f.key, e.target.value)}
                  />
                )}
              </Field>
              <div className="absolute right-0 top-0 flex items-center gap-2.5">
                {!data.readOnly && (
                  <a
                    href={`/projects/${data.projectId}/chat?focus=2.${f.key}`}
                    className="inline-flex items-center gap-1 text-[10px] leading-5 text-ink-300 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-600"
                    title="到对话中重说:讲一句新说法,Agent帮你覆盖这一项"
                  >
                    <MessageCircle size={10} strokeWidth={2.2} aria-hidden />
                    重说
                  </a>
                )}
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full transition-all duration-300",
                    filled ? "anim-pop-in bg-emerald-100 text-emerald-600" : "bg-ink-100 text-ink-300"
                  )}
                  aria-hidden
                >
                  <Check size={11} strokeWidth={3} />
                </span>
              </div>
            </div>
          );
        })}
        {saved && !data.readOnly && (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600" role="status">
            <Check size={12} strokeWidth={3} aria-hidden />
            队伍信息已保存
          </p>
        )}
        {!data.readOnly && (
          <Field label="参赛模式">
            <Select
              value={team.mode}
              disabled={data.readOnly || team.members.length >= 2}
              onChange={(e) => {
                setTeam((prev) => ({ ...prev, mode: e.target.value }));
                save({ mode: e.target.value });
              }}
            >
              <option value="SOLO">单人参赛</option>
              <option value="ECHO">Echo:问题与需求</option>
              <option value="DELTA">Delta:构建与测试</option>
              <option value="DUO">双人互补</option>
            </Select>
          </Field>
        )}
      </div>

      {data.readOnly && <Button variant="secondary" onClick={() => window.print()}>打印本页</Button>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TEAM_FIELDS } from "@/lib/steps";
import { TEAM_MODE_LABELS } from "@/lib/constants";
import { Alert, Badge, Button, Field, Input, Select, Textarea } from "./ui";
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
    <div className="space-y-5">
      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-medium text-slate-800">{team.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge tone={team.members.length >= 2 ? "green" : "gray"}>
                {team.members.length}/2 人
              </Badge>
              <span>{TEAM_MODE_LABELS[team.mode as keyof typeof TEAM_MODE_LABELS] ?? team.mode}</span>
            </p>
          </div>
          {!data.readOnly && team.members.length < 2 && (
            <div className="text-right text-xs text-slate-500">
              <p>邀请码</p>
              <code className="mt-0.5 inline-block rounded bg-slate-100 px-2 py-1 text-base font-semibold tracking-widest text-slate-800">
                {team.inviteCode}
              </code>
              <p className="mt-0.5">发给搭档,在「邀请码加入」页使用</p>
            </div>
          )}
        </div>
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {team.members.map((m, i) => (
            <li key={i}>
              {m.name} <span className="text-xs text-slate-400">({seatLabel[m.seatRole] ?? m.seatRole})</span>
            </li>
          ))}
        </ul>
        {!data.readOnly && (
          <div className="mt-3">
            <Alert tone="info">
              每队最多2名核心成员。不允许通过「顾问、外围成员、技术支持」等名义变相扩大团队;第三人前后端与数据库都会被阻止。
            </Alert>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">原创与公平披露(必填,提交前会校验)</h3>
        {TEAM_FIELDS.map((f) => (
          <div key={f.key} className="relative">
            <Field label={f.label} required={f.required}>
              {f.type === "textarea" ? (
                <Textarea
                  rows={2}
                  disabled={data.readOnly}
                  placeholder={f.placeholder}
                  value={String(team[f.key as keyof typeof team] ?? "")}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              ) : (
                <Input
                  disabled={data.readOnly}
                  placeholder={f.placeholder}
                  value={String(team[f.key as keyof typeof team] ?? "")}
                  onChange={(e) => update(f.key, e.target.value)}
                />
              )}
            </Field>
            {!data.readOnly && (
              <a
                href={`/projects/${data.projectId}/chat?focus=2.${f.key}`}
                className="absolute right-0 top-0 text-[10px] leading-5 text-ink-300 underline decoration-dotted underline-offset-2 transition-colors hover:text-brand-600"
                title="到对话中重说:讲一句新说法,Agent帮你覆盖这一项"
              >
                💬 重说
              </a>
            )}
          </div>
        ))}
        {saved && !data.readOnly && <p className="text-xs text-emerald-600">队伍信息已保存</p>}
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

"use client";

// 成就与段位的客户端层:从向导实时数据推导,跨越阈值即庆祝(localStorage记忆已展示)。

import { useEffect, useMemo, useRef, useState } from "react";
import { computeProjectProgress, type ProjectProgress } from "@/lib/progress";
import type { ProjectBundleLike } from "@/lib/progress";
import { summarizeTestRecords } from "@/lib/project-evidence";
import {
  ACHIEVEMENTS,
  RARITY_LABEL,
  RARITY_RING,
  evaluateAchievements,
  levelOf,
  levelProgress,
  nextLevel,
  type AchievementDef,
} from "@/lib/gamification";
import type { WizardData } from "./wizard-types";
import { celebrateAchievement } from "./fx";
import { cn } from "./ui";
import { Lock } from "lucide-react";

export function wizardToBundleLike(data: WizardData): ProjectBundleLike {
  return {
    project: {
      title: data.title,
      track: data.track,
      status: data.status,
      returnReason: data.returnReason,
      createdAt: new Date(0),
      submittedAt: null,
    },
    team: data.team as unknown as Record<string, unknown>,
    stages: Object.entries(data.stages).map(([step, d]) => ({ step: Number(step), data: JSON.stringify(d) })),
    testCases: data.testCases,
    feedbackTimes: data.feedbacks.map((f) => f.createdAt),
  };
}

export function wizardProgress(data: WizardData): ProjectProgress {
  return computeProjectProgress(wizardToBundleLike(data), {
    feedbackCount: data.feedbacks.length,
    hasSnapshot: data.snapshots.length > 0,
  });
}

/** 监听成就跨越:新解锁→彩带+Toast(每个错开600ms,避免轰炸);史诗走全屏仪式 */
export function useAchievementCelebration(projectId: string, unlocked: AchievementDef[]) {
  const [seen, setSeen] = useState<string[]>([]);
  const hydrated = useRef(false);
  const storageKey = `ynav-ach:${projectId}`;
  const idsKey = unlocked.map((a) => a.id).join(",");

  useEffect(() => {
    try {
      setSeen(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      setSeen([]);
    }
    const t = setTimeout(() => (hydrated.current = true), 800);
    return () => clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    const fresh = unlocked.filter((a) => !seen.includes(a.id));
    if (fresh.length === 0) return;
    fresh.forEach((a, i) => setTimeout(() => celebrateAchievement(a, projectId), i * 700));
    setSeen(idsKey.split(",").filter(Boolean));
    try {
      localStorage.setItem(storageKey, JSON.stringify(idsKey.split(",").filter(Boolean)));
    } catch {
      /* 无痕模式等场景静默降级 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return seen;
}

export function useAchievementTracker(projectId: string, data: WizardData): AchievementDef[] {
  const unlocked = useMemo(() => {
    const progress = wizardProgress(data);
    const testRecordSummary = summarizeTestRecords(data.testCases);
    return evaluateAchievements({
      progress,
      teamExists: data.team.members.length > 0,
      feedbackCount: data.feedbacks.length,
      hasSnapshot: data.snapshots.length > 0,
      submitted: ["SUBMITTED", "PRELIMINARY", "FINAL"].includes(data.status),
      hasDocumentedFailure: testRecordSummary.hasDocumentedFailure,
    });
  }, [data]);
  useAchievementCelebration(projectId, unlocked);
  return unlocked;
}

/** 段位徽章:朱砂印泥方章 + 层叠柔影(icon 为段位数据资产,非装饰图标) */
export function LevelBadge({ pct, submitted, compact }: { pct: number; submitted: boolean; compact?: boolean }) {
  const lv = levelOf(pct, submitted);
  return (
    <div className={cn("flex items-center gap-2.5", compact && "gap-2")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-paper ring-1 ring-inset ring-white/25",
          "shadow-[0_1px_2px_rgba(124,47,24,0.28),0_10px_22px_-8px_rgba(124,47,24,0.5),inset_0_1px_0_rgba(255,255,255,0.22)]",
          compact ? "h-9 w-9 text-base" : "h-12 w-12 text-[22px]"
        )}
        title={lv.title}
      >
        {lv.icon}
      </div>
      <div className="min-w-0">
        <p className={cn("font-bold tracking-tight text-ink-900", compact ? "text-[13px]" : "text-sm")}>
          Lv.<span className="tnum">{lv.lv}</span> {lv.name}
        </p>
        {!compact && <p className="mt-0.5 text-[11px] leading-4 text-ink-500">{lv.title}</p>}
      </div>
    </div>
  );
}

/** XP条:距离下一段位——细轨道 + 朱砂渐变,变化即状态叙事 */
export function XpBar({ pct, submitted }: { pct: number; submitted: boolean }) {
  const cur = levelOf(pct, submitted);
  const next = nextLevel(pct, submitted);
  const inner = levelProgress(pct, submitted);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">段位经验</span>
        <span className="tnum text-[11px] font-medium text-ink-600">
          {next ? `距 ${next.icon} ${next.name} 还差 ${100 - inner}%` : "已满级"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(inner)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="段位经验进度"
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 shadow-[inset_0_1px_2px_rgba(28,25,23,0.06)]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 via-brand-500 to-brand-600 transition-[width] duration-700 ease-soft"
          style={{ width: `${inner}%` }}
        />
      </div>
      <p className="mt-1.5 hidden text-[10px] leading-4 text-ink-500 sm:block">{cur.title}</p>
    </div>
  );
}

/** 成就墙:已解锁点亮(rarity 材质分层),未解锁为幽灵态 + 角标锁 */
export function AchievementShelf({ unlockedIds, dense }: { unlockedIds: string[]; dense?: boolean }) {
  return (
    <div className={cn("grid gap-2", dense ? "grid-cols-6 sm:grid-cols-11" : "grid-cols-4 sm:grid-cols-6")}>
      {ACHIEVEMENTS.map((a) => {
        const got = unlockedIds.includes(a.id);
        return (
          <div
            key={a.id}
            title={`${a.name} · ${RARITY_LABEL[a.rarity]}:${a.desc}`}
            className={cn(
              "group relative flex flex-col items-center justify-center rounded-lg ring-1 ring-inset transition-[box-shadow,transform] duration-150 ease-soft",
              dense ? "h-12 w-12" : "gap-1.5 p-3",
              got
                ? cn(RARITY_RING[a.rarity], "cursor-default shadow-[0_1px_2px_rgba(28,25,23,0.06),0_6px_14px_-8px_rgba(28,25,23,0.18)]")
                : "bg-ink-50/70 ring-ink-900/10"
            )}
          >
            <span className={cn("leading-none transition-transform duration-150", dense ? "text-lg" : "text-2xl", !got && "opacity-20 grayscale", got && "hover:wiggle")}>{a.icon}</span>
            {!dense && (
              <span className={cn("text-center text-[10px] font-medium leading-3", got ? "text-ink-700" : "text-ink-400")}>
                {a.name}
              </span>
            )}
            {a.rarity === "epic" && got && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            {!got && (
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#fffdf8] text-ink-400 shadow-[0_1px_2px_rgba(28,25,23,0.12)] ring-1 ring-ink-900/10">
                <Lock className="h-2 w-2" strokeWidth={2.5} aria-hidden />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 工作台用的轻量成就墙(dense图标模式)+ 统计 */
export function AchievementSummary({ unlockedIds }: { unlockedIds: string[] }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-500">
          成就 <span className="tnum text-ink-700">{unlockedIds.length}</span>
          <span className="tnum text-ink-400">/{ACHIEVEMENTS.length}</span>
        </p>
        <span className="flex items-center gap-2 text-[10px] text-ink-400">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />史诗</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />稀有</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ink-300" />普通</span>
        </span>
      </div>
      <AchievementShelf unlockedIds={unlockedIds} dense />
    </div>
  );
}

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

/** 段位徽章 */
export function LevelBadge({ pct, submitted, compact }: { pct: number; submitted: boolean; compact?: boolean }) {
  const lv = levelOf(pct, submitted);
  return (
    <div className={cn("flex items-center gap-2.5", compact && "gap-2")}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-[0_3px_10px_rgba(79,70,229,0.35)] ring-2 ring-white",
          compact ? "h-9 w-9 text-lg" : "h-12 w-12 text-2xl"
        )}
        title={lv.title}
      >
        {lv.icon}
      </div>
      <div className="min-w-0">
        <p className={cn("font-bold tracking-tight text-slate-900", compact ? "text-[13px]" : "text-sm")}>
          Lv.{lv.lv} {lv.name}
        </p>
        {!compact && <p className="text-[11px] leading-4 text-slate-400">{lv.title}</p>}
      </div>
    </div>
  );
}

/** XP条:距离下一段位 */
export function XpBar({ pct, submitted }: { pct: number; submitted: boolean }) {
  const cur = levelOf(pct, submitted);
  const next = nextLevel(pct, submitted);
  const inner = levelProgress(pct, submitted);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">段位经验</span>
        <span className="tnum font-medium text-slate-600">{next ? `距 ${next.icon} ${next.name} 还差 ${100 - inner}%` : "已满级"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 via-indigo-500 to-brand-600 transition-[width] duration-700"
          style={{ width: `${inner}%` }}
        />
      </div>
      <p className="mt-1 hidden text-[10px] text-slate-300 sm:block">{cur.title}</p>
    </div>
  );
}

/** 成就墙:已解锁点亮,未解锁置灰 */
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
              "group relative flex flex-col items-center justify-center rounded-xl ring-1 ring-inset transition-all",
              dense ? "h-12 w-12" : "gap-1.5 p-3",
              got ? cn(RARITY_RING[a.rarity], "cursor-default") : "bg-slate-50/60 ring-slate-200/70"
            )}
          >
            <span className={cn("leading-none transition-transform", dense ? "text-lg" : "text-2xl", !got && "opacity-25 grayscale", got && "hover:wiggle")}>{a.icon}</span>
            {!dense && (
              <span className={cn("text-center text-[10px] font-medium leading-3", got ? "text-slate-700" : "text-slate-400")}>
                {a.name}
              </span>
            )}
            {a.rarity === "epic" && got && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            )}
            {!got && <span className="absolute inset-0 flex items-center justify-center rounded-xl text-xs">🔒</span>}
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
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          成就 {unlockedIds.length}/{ACHIEVEMENTS.length}
        </p>
        <span className="text-[10px] text-slate-400">史诗金色 · 稀有蓝色 · 普通灰色</span>
      </div>
      <AchievementShelf unlockedIds={unlockedIds} dense />
    </div>
  );
}

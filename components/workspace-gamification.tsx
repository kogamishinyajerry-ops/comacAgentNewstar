"use client";

// 工作台的段位+成就墙客户端区块(数据由服务端进度行传入)

import { useMemo } from "react";
import { evaluateAchievements, type AchievementDef } from "@/lib/gamification";
import type { ProjectProgress } from "@/lib/progress";
import { AchievementSummary, LevelBadge, XpBar, useAchievementCelebration } from "./achievements";
import { ArtGallery } from "./gallery";

export function WorkspaceGamification({
  projectId,
  title,
  progress,
  teamExists,
  feedbackCount,
  hasSnapshot,
  submitted,
  hasDocumentedFailure,
}: {
  projectId: string;
  title: string;
  progress: ProjectProgress;
  teamExists: boolean;
  feedbackCount: number;
  hasSnapshot: boolean;
  submitted: boolean;
  hasDocumentedFailure: boolean;
}) {
  const unlocked: AchievementDef[] = useMemo(
    () =>
      evaluateAchievements({
        progress,
        teamExists,
        feedbackCount,
        hasSnapshot,
        submitted,
        hasDocumentedFailure,
      }),
    [progress, teamExists, feedbackCount, hasSnapshot, submitted, hasDocumentedFailure]
  );
  useAchievementCelebration(projectId, unlocked);
  void title;

  return (
    <div className="space-y-3.5">
      <LevelBadge pct={progress.overallPct} submitted={submitted} />
      <XpBar pct={progress.overallPct} submitted={submitted} />
      <AchievementSummary unlockedIds={unlocked.map((a) => a.id)} />
      <ArtGallery projectId={projectId} dense />
      <p className="text-[10px] leading-4 text-slate-400">
        成就与插画由项目真实状态点亮:完成必填、补齐闭环、如实记录失败都会解锁;无排名,只有你自己的进度。
      </p>
    </div>
  );
}

import type { Metadata } from "next";
import { CoachWorkbench } from "@/components/hub/coach-workbench";
import { CoachArtPrefetch } from "@/components/hub/coach-art-prefetch";
import { GameGradeVerticalSlice } from "@/components/hub/game-grade-vertical-slice";
import type { CoachEntry } from "@/fixtures/coach-demo";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `沉浸式问题探索 · ${site.title}`,
  description: `${site.brand.name} Game-grade Vertical Slice：用一次性体验序章与可见的行动后果，把三次判断凝结成问题种子。`,
};

export default function ExperiencePage({
  searchParams,
}: {
  searchParams: { entry?: string };
}) {
  const entry: CoachEntry =
    searchParams?.entry === "idea" ? "idea" : "problem";

  return (
    <>
      <GameGradeVerticalSlice>
        <CoachWorkbench entry={entry} entryBasePath="/start" />
      </GameGradeVerticalSlice>
      <CoachArtPrefetch />
    </>
  );
}

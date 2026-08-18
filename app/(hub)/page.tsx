import { CoachWorkbench } from "@/components/hub/coach-workbench";
import { CoachArtPrefetch } from "@/components/hub/coach-art-prefetch";
import type { CoachEntry } from "@/fixtures/coach-demo";

/**
 * 公共 Hub 主界面。活动背景退到独立指南页；本页只保留固定视口 Coach 工作台。
 */
export default function HubHomePage({ searchParams }: { searchParams?: { entry?: string } }) {
  const entry: CoachEntry = searchParams?.entry === "idea" ? "idea" : "problem";
  return (
    <>
      <CoachWorkbench entry={entry} entryBasePath="/" />
      <CoachArtPrefetch />
    </>
  );
}

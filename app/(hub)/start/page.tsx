import type { Metadata } from "next";
import { CoachWorkbench } from "@/components/hub/coach-workbench";
import { CoachArtPrefetch } from "@/components/hub/coach-art-prefetch";
import type { CoachEntry } from "@/fixtures/coach-demo";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: `问题探索 · ${site.title}`,
  description: `${site.brand.name}三幕式 AI Coach 问题探索：一幕只追问一个关键问题，凝结出诚实标注缺口的问题种子。`,
};

export default function StartPage({
  searchParams,
}: {
  searchParams: { entry?: string };
}) {
  const entry: CoachEntry = searchParams?.entry === "idea" ? "idea" : "problem";

  return (
    <>
      <CoachWorkbench entry={entry} entryBasePath="/start" />
      <CoachArtPrefetch />
    </>
  );
}

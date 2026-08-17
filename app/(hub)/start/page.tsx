import { CoachWorkbench } from "@/components/hub/coach-workbench";
import type { CoachEntry } from "@/fixtures/coach-demo";

export default function StartPage({
  searchParams,
}: {
  searchParams: { entry?: string };
}) {
  const entry: CoachEntry = searchParams?.entry === "idea" ? "idea" : "problem";

  return <CoachWorkbench entry={entry} entryBasePath="/start" />;
}

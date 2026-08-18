import type { CoachEntry } from "@/fixtures/coach-demo";
import { CoachFlow } from "./coach-flow";

/** 公共 Hub 的主界面：固定视口，只有 Coach 会话记录区可滚动。 */
export function CoachWorkbench({
  entry,
  entryBasePath,
}: {
  entry: CoachEntry;
  entryBasePath: "/" | "/start";
}) {
  return (
    <section
      className="hub-workspace-screen"
      aria-label="AI Coach 问题探索工作台"
      data-coach-workbench
    >
      <CoachFlow
        key={entry}
        entry={entry}
        entryBasePath={entryBasePath}
        orbIdPrefix="workbench-coach"
      />
    </section>
  );
}

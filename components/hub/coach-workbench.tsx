import Image from "next/image";
import Link from "next/link";
import type { CoachEntry } from "@/fixtures/coach-demo";
import { site } from "@/config/site";
import { CoachFlow } from "./coach-flow";
import styles from "./coach-workbench.module.css";

/**
 * 公共 Hub 的主界面：固定视口，只有 Coach 会话记录区可滚动。
 * 根入口额外提供一条极薄的活动定向层；/start 保持纯 Coach 场景。
 */
export function CoachWorkbench({
  entry,
  entryBasePath,
}: {
  entry: CoachEntry;
  entryBasePath: "/" | "/start";
}) {
  const isPublicEntry = entryBasePath === "/";

  return (
    <section
      className={`hub-workspace-screen ${styles.shell}`}
      aria-label="AI Coach 问题探索工作台"
      data-coach-workbench
    >
      {isPublicEntry && (
        <aside className={styles.orientation} aria-label="活动与实践方向" data-hub-orientation>
          <Image
            src="/hub/art/hub-hero-cognitive-canvas.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.orientationArt}
          />
          <div className={styles.orientationWash} aria-hidden="true" />
          <div className={styles.orientationCopy}>
            <p className={styles.orientationEyebrow}>{site.brand.name}</p>
            <p className={styles.orientationTitle}>把一个真实问题，变成可验证的 Agent 作品</p>
            <p className={styles.orientationPromise}>
              <span>直接回答当前唯一问题</span>
              <span>三幕追问后凝结问题种子</span>
              <span>再去外部构建并带回证据</span>
            </p>
            <p className={styles.orientationMobileSummary} data-hub-orientation-mobile-summary>
              直接回答 → 三幕追问 → 问题种子 → 外部构建与证据
            </p>
          </div>
          <Link href="/guide" className={styles.orientationLink}>
            活动如何进行 <span aria-hidden="true">→</span>
          </Link>
        </aside>
      )}

      <div className={styles.flow}>
        <CoachFlow
          key={entry}
          entry={entry}
          entryBasePath={entryBasePath}
          orbIdPrefix="workbench-coach"
        />
      </div>
    </section>
  );
}

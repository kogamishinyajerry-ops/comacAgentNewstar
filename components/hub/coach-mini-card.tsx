"use client";

import { artifactCopy, coachProgressCopy } from "@/fixtures/coach-demo";
import type { MiniSlot } from "@/lib/hub/coach-machine";

/**
 * 打磨轮⑥(§29):常驻问题卡——"对话逐格填写"的可视模板。
 * 桌面(≥1101px)为右栏卡片;窄屏折叠为顶栏下方一行进度条(同一 DOM,CSS 双布局)。
 * 只读展示,不是第二决策点;幽灵槽明确"待打磨",避免企业表单感。
 * 刚沉淀槽位由父层以 justFilledKey 标记:进场 pulse 一次,等待期持续微光。
 */
export function CoachMiniCard({
  slots,
  showDeepenings,
  justFilledKey,
  waiting,
}: {
  /** 全量槽位(三幕+已完成深化);渲染层按 showDeepenings 决定深化区 */
  slots: readonly MiniSlot[];
  /** 第四幕阶段才渲染深化区(固定三维模板:完成点亮,未完幽灵) */
  showDeepenings: boolean;
  /** 刚沉淀的槽位 key;高亮以数据属性表达,动效交给 CSS */
  justFilledKey: string | null;
  /** 真实请求在途:刚沉淀槽位保持微光 */
  waiting: boolean;
}) {
  const actSlots = slots.filter((slot) => !slot.key.startsWith("deepening-"));
  const deepeningSlots = slots.filter((slot) => slot.key.startsWith("deepening-"));
  const filledCount = actSlots.filter((slot) => slot.filled).length;

  return (
    <aside
      className="coach-progress"
      data-coach-progress
      data-coach-progress-waiting={waiting ? "true" : "false"}
      aria-label={`问题卡（已沉淀 ${filledCount}/3）`}
    >
      <p className="coach-progress-title">
        {coachProgressCopy.cardTitle}
        <span className="coach-progress-count" aria-hidden="true">
          {filledCount}/3
        </span>
      </p>

      <ul className="coach-progress-slots">
        {actSlots.map((slot) => (
          <li
            key={slot.key}
            className={`coach-progress-slot${slot.filled ? " coach-progress-slot--filled" : ""}${
              slot.key === justFilledKey ? " coach-progress-slot--just" : ""
            }`}
            data-coach-slot={slot.key}
            data-coach-slot-filled={slot.filled ? "true" : "false"}
            {...(slot.key === justFilledKey ? { "data-coach-slot-just": "true" } : {})}
          >
            <span className="coach-progress-slot-label">{slot.label}</span>
            <span className="coach-progress-slot-text">
              {slot.filled ? slot.text : coachProgressCopy.ghostLabel}
            </span>
          </li>
        ))}
      </ul>

      {showDeepenings && (
        <div className="coach-progress-deepening" data-coach-progress-deepening>
          <p className="coach-progress-subtitle">{coachProgressCopy.deepeningSectionLabel}</p>
          <ul className="coach-progress-slots coach-progress-slots--deepening">
            {artifactCopy.dimensionLabels.map((label, index) => {
              const done = deepeningSlots[index];
              const key = `deepening-${index}` as const;
              return (
                <li
                  key={key}
                  className={`coach-progress-slot${done ? " coach-progress-slot--filled" : ""}${
                    done && done.key === justFilledKey ? " coach-progress-slot--just" : ""
                  }`}
                  data-coach-slot={key}
                  data-coach-slot-filled={done ? "true" : "false"}
                  {...(done && done.key === justFilledKey ? { "data-coach-slot-just": "true" } : {})}
                >
                  <span className="coach-progress-slot-label">{label}</span>
                  {done && <span className="coach-progress-slot-text">{done.text}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="coach-progress-gaps">
        <span aria-hidden="true">◇</span>
        {coachProgressCopy.gapsSummary}
      </p>
      <p className="coach-progress-note">{coachProgressCopy.cardNote}</p>
    </aside>
  );
}

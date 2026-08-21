"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { getStepConfig } from "@/lib/steps";
import type { FeedbackItem, WizardData } from "@/components/wizard-types";
import {
  buildDecisionArtifact,
  decisionActionLabel,
  decisionStateLabel,
  findDecisionArtifact,
  hasValidationEvent,
  parseDecisionArtifact,
  parseDecisionArtifacts,
  upsertDecisionArtifact,
  withDecisionArtifacts,
} from "@/lib/agent-collaboration/decision";
import type {
  DecisionArtifact,
  DecisionEvidence,
  DecisionIntent,
} from "@/lib/agent-collaboration/types";
import styles from "./decision-workspace.module.css";

const PHASES = [
  { id: "setup", label: "活动设置", detail: "规则、组队与赛道", steps: [1, 2, 3] },
  { id: "problem", label: "问题定义", detail: "谁在什么场景遇到什么麻烦", steps: [4] },
  { id: "criteria", label: "判定标准", detail: "什么结果算可用", steps: [5] },
  { id: "mvp", label: "最小方案", detail: "闭环、人机边界与指标", steps: [6] },
  { id: "evidence", label: "验证证据", detail: "诊断、测试与缺口", steps: [7, 8] },
  { id: "delivery", label: "提交签收", detail: "预检、版本与后续状态", steps: [9, 10] },
] as const;

const PRIMARY_KEYS: Record<number, string[]> = {
  1: ["agreeRules", "agreeDataSafety", "agreeOriginality"],
  4: ["scenario", "worstStep", "targetUser"],
  5: ["usableResult", "judgmentSource", "stopConditions"],
  6: ["oneSentenceMvp", "coreLoop", "verifiableMetric"],
};
const EMPTY_STAGE: Record<string, unknown> = {};

type ActionMode = "modify" | "question" | "defer" | null;
type Notice = { tone: "ok" | "error"; message: string } | null;

type ArtifactRow = {
  key: string;
  label: string;
  value: string;
};

function displayValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "已确认" : "未确认";
  if (Array.isArray(value)) return value.map(displayValue).filter(Boolean).join("、");
  return "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function phaseState(step: number, phaseSteps: readonly number[]): "complete" | "current" | "future" {
  const min = Math.min(...phaseSteps);
  const max = Math.max(...phaseSteps);
  if (step > max) return "complete";
  if (step >= min && step <= max) return "current";
  return "future";
}

function phaseHref(projectId: string, currentStep: number, phaseSteps: readonly number[]): string {
  const target = phaseSteps.includes(currentStep) ? currentStep : phaseSteps[0];
  return `/projects/${projectId}?step=${target}`;
}

function artifactRows(data: WizardData, step: number, stage: Record<string, unknown>): ArtifactRow[] {
  if (step === 2) {
    return [
      { key: "teamName", label: "队伍", value: data.team.name },
      { key: "mode", label: "协作方式", value: data.team.mode },
      { key: "existingBase", label: "活动前已有基础", value: data.team.existingBase ?? "" },
      { key: "addedDuringActivity", label: "活动期间新增", value: data.team.addedDuringActivity ?? "" },
      { key: "externalResources", label: "外部资源", value: data.team.externalResources ?? "" },
    ].filter((row) => row.value.trim());
  }
  if (step === 3) {
    return data.track ? [{ key: "track", label: "当前赛道", value: data.track }] : [];
  }
  if (step === 7) {
    const latest = data.feedbacks.find((feedback) => feedback.step <= 7);
    return latest
      ? [
          { key: "assessment", label: "最新阶段判断", value: latest.content.stage_assessment },
          { key: "summary", label: "诊断摘要", value: latest.content.summary },
          { key: "next", label: "下一步", value: latest.content.next_action },
        ]
      : [];
  }
  if (step === 8) {
    const passCount = data.testCases.filter((item) => item.verdict === "PASS").length;
    const failCount = data.testCases.filter((item) => item.verdict === "FAIL").length;
    const pendingCount = data.testCases.filter((item) => item.verdict === "PENDING").length;
    return [
      { key: "total", label: "已记录案例", value: `${data.testCases.length} 个` },
      { key: "pass", label: "通过", value: `${passCount} 个` },
      { key: "fail", label: "失败且可解释", value: `${failCount} 个` },
      { key: "pending", label: "待验证", value: `${pendingCount} 个` },
    ];
  }
  if (step >= 9) {
    return [
      { key: "status", label: "项目状态", value: data.status },
      { key: "snapshots", label: "不可变提交版本", value: `${data.snapshots.length} 个` },
      { key: "returnReason", label: "退回原因", value: data.returnReason ?? "" },
    ].filter((row) => row.value.trim());
  }

  const config = getStepConfig(step);
  if (!config) return [];
  return config.fields
    .map((field) => ({ key: field.key, label: field.label, value: displayValue(stage[field.key]) }))
    .filter((row) => row.value);
}

function primaryArtifactCopy(step: number, rows: ArtifactRow[]): string {
  const keys = PRIMARY_KEYS[step] ?? [];
  for (const key of keys) {
    const row = rows.find((item) => item.key === key);
    if (row?.value) return row.value;
  }
  return rows[0]?.value ?? "";
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    PARTICIPANT: "项目成员",
    ORGANIZER: "组织者",
    JUDGE: "评委",
    ADMIN: "管理员",
  };
  return labels[role] ?? role;
}

export function DecisionWorkspace({
  data,
  actorName,
  actorRole,
}: {
  data: WizardData;
  actorName: string;
  actorRole: string;
}) {
  const step = data.currentStep;
  const [stages, setStages] = useState(data.stages);
  const [feedbacks, setFeedbacks] = useState(data.feedbacks);
  const initialFeedback = data.feedbacks.find((feedback) => feedback.step === step) ?? null;
  const [focusFeedbackId, setFocusFeedbackId] = useState<string | null>(initialFeedback?.id ?? null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode>(null);
  const [draft, setDraft] = useState("");
  const [questionAnswer, setQuestionAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const stage = useMemo(() => stages[step] ?? EMPTY_STAGE, [stages, step]);
  const config = getStepConfig(step);
  const rows = useMemo(() => artifactRows({ ...data, feedbacks }, step, stage), [data, feedbacks, stage, step]);
  const primaryCopy = primaryArtifactCopy(step, rows);
  const stepFeedbacks = feedbacks.filter((feedback) => feedback.step === step);
  const activeFeedback =
    stepFeedbacks.find((feedback) => feedback.id === focusFeedbackId) ?? stepFeedbacks[0] ?? null;
  const suggestions = activeFeedback?.content.suggestions ?? [];
  const safeSuggestionIndex = Math.min(Math.max(0, selectedSuggestion), Math.max(0, suggestions.length - 1));
  const suggestion = suggestions[safeSuggestionIndex];
  const decisions = parseDecisionArtifacts(stage);
  const persistedDecision = activeFeedback
    ? findDecisionArtifact(decisions, activeFeedback.id, safeSuggestionIndex)
    : undefined;

  const previewEvidence: DecisionEvidence[] = activeFeedback
    ? [
        {
          id: `stage:${data.projectId}:${step}`,
          kind: "stage",
          label: `${config?.title ?? `阶段 ${step}`} · 本轮读取的阶段 Artifact`,
          excerpt: primaryCopy || "本轮读取为空白阶段。",
        },
        {
          id: `feedback:${activeFeedback.id}`,
          kind: "feedback",
          label: "AI 导师结构化诊断",
          excerpt: activeFeedback.content.summary,
          version: activeFeedback.createdAt,
        },
        ...(activeFeedback.run
          ? [
              {
                id: `run:${activeFeedback.run.feedbackId}`,
                kind: "run" as const,
                label: `Agent Run · ${activeFeedback.run.provider}/${activeFeedback.run.model}`,
                version: `${activeFeedback.run.promptVersionLabel ?? "prompt-unversioned"} · ${activeFeedback.run.status}`,
              },
            ]
          : []),
      ]
    : [];

  const previewDecision =
    activeFeedback && suggestion
      ? buildDecisionArtifact({
          projectId: data.projectId,
          subjectRef: `project:${data.projectId}:stage:${step}`,
          stage: step,
          title: suggestion.title,
          proposal: suggestion.action,
          reasons: unique([suggestion.why, activeFeedback.content.summary]),
          evidence: previewEvidence,
          assumptions: activeFeedback.content.critical_gaps.map((gap) => `${gap.field}：${gap.reason}`),
          uncertainties: activeFeedback.content.risk_flags.map((risk) => risk.message),
          impacts: [
            `确认后仅写入“${config?.title ?? `阶段 ${step}`}”的决策记录。`,
            "不会自动提交作品、覆盖其他字段或执行外部工具。",
          ],
          feedbackId: activeFeedback.id,
          suggestionIndex: safeSuggestionIndex,
          createdAt: activeFeedback.createdAt,
        })
      : null;

  const decision = persistedDecision ?? previewDecision;
  const validationComplete = Boolean(decision && hasValidationEvent(decision));
  const activeEvidence = decision?.evidence.find((item) => item.id === activeEvidenceId) ?? null;
  const pendingQuestion = activeFeedback?.content.questions[0];
  const pendingQuestionCopy =
    typeof pendingQuestion === "string" ? pendingQuestion : pendingQuestion?.q ?? "";
  const pendingQuestionWhy = typeof pendingQuestion === "object" ? pendingQuestion.why ?? "" : "";
  const unresolved = unique([
    ...(activeFeedback?.content.critical_gaps.map((gap) => gap.reason) ?? []),
    ...(activeFeedback?.content.risk_flags.map((risk) => risk.message) ?? []),
  ]).slice(0, 3);
  const timeline = decisions
    .flatMap((artifact) => artifact.events)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  function updateArtifact(artifact: DecisionArtifact) {
    setStages((current) => {
      const currentStage = current[step] ?? {};
      const next = upsertDecisionArtifact(parseDecisionArtifacts(currentStage), artifact);
      return { ...current, [step]: withDecisionArtifacts(currentStage, next) };
    });
  }

  function updateSuggestionState(intent: DecisionIntent) {
    if (!activeFeedback) return;
    const nextState = intent === "signoff" ? "done" : intent === "approve" || intent === "modify" ? "adopted" : null;
    if (!nextState) return;
    setFeedbacks((current) =>
      current.map((feedback) =>
        feedback.id === activeFeedback.id
          ? {
              ...feedback,
              suggestionStates: {
                ...feedback.suggestionStates,
                [String(safeSuggestionIndex)]: nextState,
              },
            }
          : feedback,
      ),
    );
  }

  async function postDecision(
    intent: DecisionIntent,
    options: { rationale?: string; modifiedProposal?: string; validationFeedbackId?: string } = {},
  ): Promise<DecisionArtifact> {
    if (!activeFeedback || !suggestion) throw new Error("当前没有可处理的 Agent 建议");
    const response = await fetch(`/api/projects/${data.projectId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        step,
        feedbackId: activeFeedback.id,
        suggestionIndex: safeSuggestionIndex,
        intent,
        ...options,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; artifact?: unknown };
    if (!response.ok) throw new Error(payload.error ?? "决策保存失败");
    const artifact = parseDecisionArtifact(payload.artifact);
    if (!artifact) throw new Error("服务端返回的 Decision Artifact 无法读取");
    return artifact;
  }

  async function applyIntent(intent: DecisionIntent, options: { rationale?: string; modifiedProposal?: string } = {}) {
    if (data.readOnly || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const artifact = await postDecision(intent, options);
      updateArtifact(artifact);
      updateSuggestionState(intent);
      setActionMode(null);
      setDraft("");
      const messages: Record<DecisionIntent, string> = {
        approve: "已记录：你批准了 Agent 提议，系统仅把决定写入当前 Artifact。",
        modify: "已记录：人工修改版成为当前确认版本，Agent 原提议仍保留。",
        question: "已记录质疑。该决定保持复核中，依据不会被静默接受。",
        defer: "已记录暂缓理由。当前决定保持复核中，风险会留在责任链中。",
        validate: "Coach 复核已关联到当前决定。",
        signoff: "你已完成最终签收；这条决定现在可完整追溯。",
      };
      setNotice({ tone: "ok", message: messages[intent] });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "操作失败" });
    } finally {
      setBusy(false);
    }
  }

  async function requestCoach({ validation = false }: { validation?: boolean } = {}) {
    if (data.readOnly || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/projects/${data.projectId}/agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step, purpose: "COACH" }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        feedback?: FeedbackItem["content"];
        feedbackId?: string;
        sessionId?: string;
        status?: string;
        provider?: string;
      };
      if (!response.ok || !payload.feedback || !payload.feedbackId) {
        throw new Error(payload.error ?? "Coach 本轮未返回有效诊断");
      }
      const createdAt = new Date().toISOString();
      const nextFeedback: FeedbackItem = {
        id: payload.feedbackId,
        step,
        purpose: "COACH",
        content: payload.feedback,
        suggestionStates: {},
        answers: {},
        createdAt,
        run: {
          feedbackId: payload.feedbackId,
          provider: payload.provider ?? "server",
          model: "由服务端会话记录",
          status: payload.status ?? "OK",
          latencyMs: 0,
          createdAt,
        },
      };
      setFeedbacks((current) => [nextFeedback, ...current]);

      if (validation) {
        const artifact = await postDecision("validate", { validationFeedbackId: payload.feedbackId });
        updateArtifact(artifact);
        setNotice({ tone: "ok", message: "Coach 已完成一次新的阶段复核；现在由你决定是否签收。" });
      } else {
        setFocusFeedbackId(payload.feedbackId);
        setSelectedSuggestion(0);
        setNotice({ tone: "ok", message: "新的诊断已形成。请检查建议、依据和不确定性。" });
      }
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Coach 调用失败" });
    } finally {
      setBusy(false);
    }
  }

  async function answerQuestion(event: FormEvent) {
    event.preventDefault();
    if (!activeFeedback || !questionAnswer.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/agent/feedback/${activeFeedback.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qindex: 0, answer: questionAnswer.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; answers?: Record<string, string> };
      if (!response.ok) throw new Error(payload.error ?? "回答保存失败");
      setFeedbacks((current) =>
        current.map((feedback) =>
          feedback.id === activeFeedback.id
            ? { ...feedback, answers: payload.answers ?? { ...feedback.answers, "0": questionAnswer.trim() } }
            : feedback,
        ),
      );
      setQuestionAnswer("");
      setNotice({ tone: "ok", message: "回答已记录。下一轮 Coach 会把它作为已知上下文，而不是重新猜测。" });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "回答保存失败" });
    } finally {
      setBusy(false);
    }
  }

  function openComposer(mode: Exclude<ActionMode, null>) {
    setActionMode(mode);
    setDraft(mode === "modify" ? decision?.proposal ?? "" : "");
    setNotice(null);
  }

  const composerLabel =
    actionMode === "modify"
      ? "你的确认版本"
      : actionMode === "question"
        ? "你质疑哪一项依据，为什么？"
        : "为什么现在暂缓处理？";

  const currentState = decision?.state ?? "draft";
  const advancedHref = `/projects/${data.projectId}?step=${step}&view=advanced`;

  return (
    <section className={styles.root} aria-label="Agent 协作决策工作台">
      <header className={styles.topbar}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>当前共同工作对象</p>
          <div className={styles.titleLine}>
            <h1 className={styles.title}>{data.title}</h1>
            <span className={styles.statusPill} data-state={currentState}>
              {decision ? decisionStateLabel(currentState) : "等待 Agent 建议"}
            </span>
          </div>
          <div className={styles.metaRow}>
            <span className={styles.metaPill}>阶段 {step}/10 · {config?.title ?? "当前任务"}</span>
            <span className={styles.metaPill}>你：{roleLabel(actorRole)}</span>
            <span className={styles.metaPill}>Agent：仅建议</span>
            <span className={styles.metaPill}>系统：确认后记录</span>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.advancedLink} href={advancedHref}>
            进入高级工作台 ↗
          </Link>
        </div>
      </header>

      <div className={styles.workspace}>
        <nav className={styles.rail} aria-label="任务进程">
          <div className={styles.railIntro}>
            <p className={styles.sectionEyebrow}>TASK FLOW</p>
            <h2 className={styles.railTitle}>不是功能菜单，是决定顺序</h2>
          </div>
          <ol className={styles.phaseList}>
            {PHASES.map((phase, index) => {
              const state = phaseState(step, phase.steps);
              return (
                <li key={phase.id}>
                  <Link
                    className={styles.phaseLink}
                    data-state={state}
                    href={phaseHref(data.projectId, step, phase.steps)}
                    aria-current={state === "current" ? "step" : undefined}
                  >
                    <span className={styles.phaseIndex}>{state === "complete" ? "✓" : String(index + 1).padStart(2, "0")}</span>
                    <span className={styles.phaseCopy}>
                      <span className={styles.phaseLabel}>{phase.label}</span>
                      <span className={styles.phaseState}>
                        {state === "complete" ? "已越过" : state === "current" ? phase.detail : "尚未进入"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className={styles.railFootnote}>
            当前视图只端上一个决定。完整字段、测试、附件和提交仍保留在高级工作台。
          </p>
        </nav>

        <section className={styles.canvas} aria-label="当前 Artifact">
          <div className={styles.canvasHeader}>
            <div>
              <p className={styles.sectionEyebrow}>CURRENT ARTIFACT</p>
              <h2 className={styles.canvasTitle}>{config?.title ?? `阶段 ${step}`}</h2>
            </div>
            <span className={styles.versionBadge}>
              {decision ? `Decision v${decision.version}` : data.snapshots.length ? `提交快照 v${data.snapshots[0]?.version}` : "工作版本"}
            </span>
          </div>

          <article className={styles.artifactSurface} aria-label="当前正式 Artifact">
            <p className={`${styles.artifactLead} ${primaryCopy ? "" : styles.emptyLead}`}>
              {primaryCopy || "当前阶段还没有形成可核对的正式内容。先在高级工作台补充，或请求 Coach 帮你找出最小下一步。"}
            </p>
            {rows.length > 0 && (
              <div className={styles.fieldList}>
                {rows.slice(0, 4).map((row) => (
                  <div className={styles.fieldRow} key={row.key}>
                    <span className={styles.fieldLabel}>{row.label}</span>
                    <p className={styles.fieldValue}>{row.value}</p>
                  </div>
                ))}
              </div>
            )}
            {rows.length > 4 && (
              <details className={styles.artifactDetails}>
                <summary>展开其余 {rows.length - 4} 项正式字段</summary>
                <div className={styles.fieldList}>
                  {rows.slice(4).map((row) => (
                    <div className={styles.fieldRow} key={row.key}>
                      <span className={styles.fieldLabel}>{row.label}</span>
                      <p className={styles.fieldValue}>{row.value}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </article>

          <section className={styles.diffPanel} aria-label="Artifact 差异">
            <div className={styles.diffHeader}>
              <strong>Artifact Diff</strong>
              <span>结论与建议同行，但不会被 Agent 静默覆盖</span>
            </div>
            <div className={styles.diffGrid}>
              <div className={styles.diffColumn}>
                <span className={styles.diffLabel}>当前正式版本</span>
                <p className={styles.diffCopy}>
                  <span className={styles.diffMarker}>−</span>
                  {primaryCopy || "尚无正式文本"}
                </p>
              </div>
              <div className={styles.diffColumn}>
                <span className={styles.diffLabel}>
                  {decision?.humanRevision ? `人工确认版本 · ${actorName}` : "Agent 提议版本"}
                </span>
                <p className={styles.diffCopy}>
                  <span className={styles.diffMarker}>+</span>
                  {decision?.proposal || "请求本阶段诊断后，这里只出现一项可处理建议。"}
                </p>
              </div>
            </div>
          </section>

          <section className={styles.timeline} aria-labelledby="attribution-title">
            <p className={styles.sectionEyebrow}>ATTRIBUTION</p>
            <h3 id="attribution-title">谁提出、谁修改、谁批准、谁复核</h3>
            {timeline.length ? (
              <ol className={styles.timelineList}>
                {timeline.slice(0, 8).map((event) => (
                  <li className={styles.timelineItem} data-actor={event.actorType} key={event.id}>
                    <span className={styles.timelineDot} aria-hidden="true" />
                    <p className={styles.timelineCopy}>
                      <strong>{event.actorName}</strong> {decisionActionLabel(event.action)}
                      {event.rationale ? `：${event.rationale}` : ""}
                      <span className={styles.timelineMeta}>
                        {formatDateTime(event.timestamp)} · {decisionStateLabel(event.afterState)} · {event.permissionSnapshot}
                      </span>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.readOnlyNote}>尚无责任事件。第一项 Agent 建议被人工处理后，轨迹会从这里开始。</p>
            )}
          </section>
        </section>

        <aside className={styles.coach} aria-label="AI Coach 决策区">
          <div className={styles.coachSticky}>
            <div className={styles.coachHeader}>
              <p className={styles.sectionEyebrow}>COACH / REVIEW</p>
              <h2 className={styles.coachTitle}>只处理当前一个决定</h2>
              <p className={styles.coachLead}>
                不展示原始思维流。这里只保留建议、理由、依据、不确定性、影响和你的权限。
              </p>
            </div>

            <div className={styles.authorityRow} aria-label="权限说明">
              <span className={styles.authorityBadge}>Coach · suggest</span>
              <span className={styles.metaPill}>你 · 修改 / 批准 / 签收</span>
            </div>

            {decision && activeFeedback ? (
              <article className={styles.decisionCard} aria-label="Agent Decision Brief">
                <div className={styles.decisionHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>AGENT DECISION BRIEF</p>
                    <h2 className={styles.decisionTitle}>{decision.title}</h2>
                  </div>
                  <span className={styles.statusPill} data-state={decision.state}>
                    {decisionStateLabel(decision.state)}
                  </span>
                </div>

                {suggestions.length > 1 && (
                  <div className={styles.evidenceList} aria-label="选择本轮建议">
                    {suggestions.map((item, index) => (
                      <button
                        className={styles.evidenceButton}
                        aria-expanded={index === safeSuggestionIndex}
                        key={`${activeFeedback.id}:${index}`}
                        type="button"
                        onClick={() => {
                          setSelectedSuggestion(index);
                          setActiveEvidenceId(null);
                          setActionMode(null);
                        }}
                      >
                        建议 {index + 1} · {item.title}
                      </button>
                    ))}
                  </div>
                )}

                <p className={styles.proposal}>{decision.proposal}</p>

                <section className={styles.briefSection}>
                  <h3>为什么</h3>
                  <ol className={styles.briefList}>
                    {decision.reasonSummaries.map((reason) => <li key={reason}>{reason}</li>)}
                  </ol>
                </section>

                <section className={styles.briefSection}>
                  <h3>依据</h3>
                  <div className={styles.evidenceList}>
                    {decision.evidence.map((item, index) => (
                      <button
                        type="button"
                        className={styles.evidenceButton}
                        aria-expanded={activeEvidenceId === item.id}
                        key={item.id}
                        onClick={() => setActiveEvidenceId((current) => current === item.id ? null : item.id)}
                      >
                        依据 {index + 1} · {item.label}
                      </button>
                    ))}
                  </div>
                  {activeEvidence && (
                    <div className={styles.evidenceDetail}>
                      <strong>{activeEvidence.label}</strong>
                      {activeEvidence.version && <p>{activeEvidence.version}</p>}
                      {activeEvidence.excerpt && <p>{activeEvidence.excerpt}</p>}
                      {activeEvidence.href && (
                        <a href={activeEvidence.href} target="_blank" rel="noreferrer">打开原始材料 ↗</a>
                      )}
                    </div>
                  )}
                </section>

                {decision.uncertainties.length > 0 && (
                  <section className={styles.briefSection}>
                    <h3>不确定性</h3>
                    <ul className={styles.briefList}>
                      {decision.uncertainties.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </section>
                )}

                <section className={styles.briefSection}>
                  <h3>接受后会发生什么</h3>
                  <ul className={styles.briefList}>
                    {decision.impacts.map((impact) => <li key={impact}>{impact}</li>)}
                  </ul>
                </section>

                {unresolved.length > 0 && decision.state !== "verified" && (
                  <section className={styles.softGate}>
                    <h3>软门禁 · 仍未解决</h3>
                    <ul>{unresolved.map((item) => <li key={item}>{item}</li>)}</ul>
                    <p>你仍可继续，但这些风险不会消失，也不会被系统伪装成已完成。</p>
                    {!data.readOnly && (
                      <div className={styles.actionRow}>
                        <button className={`${styles.button} ${styles.textButton}`} type="button" onClick={() => openComposer("defer")}>
                          记录暂缓理由
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {actionMode && (
                  <form
                    className={styles.inlineComposer}
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (actionMode === "modify") void applyIntent("modify", { modifiedProposal: draft });
                      if (actionMode === "question") void applyIntent("question", { rationale: draft });
                      if (actionMode === "defer") void applyIntent("defer", { rationale: draft });
                    }}
                  >
                    <label htmlFor="decision-action-draft">{composerLabel}</label>
                    <textarea
                      id="decision-action-draft"
                      className={styles.textarea}
                      value={draft}
                      maxLength={actionMode === "modify" ? 1600 : 600}
                      onChange={(event) => setDraft(event.target.value)}
                      autoFocus
                    />
                    <div className={styles.actionRow}>
                      <button className={`${styles.button} ${styles.primaryButton}`} disabled={busy || !draft.trim()} type="submit">
                        {busy
                          ? "记录中…"
                          : actionMode === "modify"
                            ? "确认人工版本"
                            : actionMode === "defer"
                              ? "记录暂缓理由"
                              : "记录并进入复核"}
                      </button>
                      <button className={`${styles.button} ${styles.textButton}`} type="button" onClick={() => setActionMode(null)}>
                        取消
                      </button>
                    </div>
                  </form>
                )}

                {!actionMode && !data.readOnly && decision.state !== "verified" && (
                  <div className={styles.actionRow}>
                    {(decision.state === "proposed" || decision.state === "under_review") && (
                      <>
                        <button className={`${styles.button} ${styles.primaryButton}`} disabled={busy} type="button" onClick={() => void applyIntent("approve")}>
                          {busy ? "记录中…" : "接受并写入 Artifact"}
                        </button>
                        <button className={`${styles.button} ${styles.secondaryButton}`} disabled={busy} type="button" onClick={() => openComposer("modify")}>
                          修改
                        </button>
                        <button className={`${styles.button} ${styles.textButton}`} disabled={busy} type="button" onClick={() => openComposer("question")}>
                          质疑依据
                        </button>
                      </>
                    )}
                    {decision.state === "executed" && !validationComplete && (
                      <button className={`${styles.button} ${styles.primaryButton}`} disabled={busy} type="button" onClick={() => void requestCoach({ validation: true })}>
                        {busy ? "Coach 复核中…" : "让 Coach 复核"}
                      </button>
                    )}
                    {decision.state === "executed" && validationComplete && (
                      <button className={`${styles.button} ${styles.primaryButton}`} disabled={busy} type="button" onClick={() => void applyIntent("signoff")}>
                        {busy ? "签收中…" : "确认签收"}
                      </button>
                    )}
                  </div>
                )}

                {data.readOnly && <p className={styles.readOnlyNote}>当前为只读权限。你可以检查依据与责任链，但不能代表项目成员作出决定。</p>}
              </article>
            ) : (
              <section className={styles.emptyCoach}>
                <p className={styles.sectionEyebrow}>NO ACTIVE DECISION</p>
                <h3>当前阶段还没有可处理的 Agent 建议</h3>
                <p>{config?.coachFocus ?? "先补充当前 Artifact，再让 Coach 提出最小下一步。"}</p>
                {!data.readOnly && (
                  <div className={styles.actionRow}>
                    <button className={`${styles.button} ${styles.primaryButton}`} disabled={busy} type="button" onClick={() => void requestCoach()}>
                      {busy ? "诊断中…" : "请求本阶段诊断"}
                    </button>
                  </div>
                )}
              </section>
            )}

            {pendingQuestionCopy && activeFeedback && (
              <form className={styles.pendingQuestion} onSubmit={answerQuestion}>
                <h3>当前最重要的问题</h3>
                <p>{pendingQuestionCopy}</p>
                {pendingQuestionWhy && <p>为什么问：{pendingQuestionWhy}</p>}
                {!activeFeedback.answers["0"] && !data.readOnly ? (
                  <>
                    <textarea
                      className={styles.textarea}
                      value={questionAnswer}
                      maxLength={600}
                      placeholder="用你自己的判断回答，不需要写成正式文档"
                      onChange={(event) => setQuestionAnswer(event.target.value)}
                    />
                    <div className={styles.actionRow}>
                      <button className={`${styles.button} ${styles.secondaryButton}`} disabled={busy || !questionAnswer.trim()} type="submit">
                        记录回答
                      </button>
                    </div>
                  </>
                ) : activeFeedback.answers["0"] ? (
                  <p><strong>你的回答：</strong>{activeFeedback.answers["0"]}</p>
                ) : null}
              </form>
            )}

            {notice && <div className={styles.notice} data-tone={notice.tone === "error" ? "error" : "ok"} role="status">{notice.message}</div>}
          </div>
        </aside>
      </div>

      <details className={styles.drawer}>
        <summary>
          <span className={styles.drawerSummary}>
            <span>Evidence & Run Trace</span>
            <span>默认折叠 · 调试与审计时展开</span>
          </span>
        </summary>
        <div className={styles.drawerBody}>
          <article className={styles.traceCard}>
            <h3>Agent Run</h3>
            {activeFeedback?.run ? (
              <div className={styles.traceMeta}>
                <span>Provider：{activeFeedback.run.provider}</span>
                <span>Model：{activeFeedback.run.model}</span>
                <span>Status：{activeFeedback.run.status}</span>
                <span>Latency：{activeFeedback.run.latencyMs ? `${activeFeedback.run.latencyMs}ms` : "由服务端记录"}</span>
                <span>Prompt：{activeFeedback.run.promptVersionLabel ?? "待记录"}</span>
                <span>Run time：{formatDateTime(activeFeedback.run.createdAt)}</span>
              </div>
            ) : (
              <p className={styles.readOnlyNote}>当前反馈没有完整运行元数据。结论仍可检查，但 L3 审计信息不完整。</p>
            )}
          </article>
          <article className={styles.traceCard}>
            <h3>权限与后果快照</h3>
            <div className={styles.traceMeta}>
              <span>Agent：只能建议与复核</span>
              <span>{actorName}：可修改、批准、质疑与签收</span>
              <span>系统：只按确认动作写入阶段 JSON</span>
              <span>不会：自动提交、运行代码、触发大规模测试</span>
            </div>
          </article>
        </div>
      </details>
    </section>
  );
}

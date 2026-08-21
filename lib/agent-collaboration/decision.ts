import {
  DECISION_ARTIFACTS_KEY,
  type ApplyDecisionIntentInput,
  type CollaborationActorType,
  type DecisionArtifact,
  type DecisionAuthorityLevel,
  type DecisionEvent,
  type DecisionEvidence,
  type DecisionIntent,
  type DecisionSeed,
  type DecisionSemanticAction,
  type DecisionState,
  type EvidenceKind,
} from "./types";

const ACTOR_TYPES: readonly CollaborationActorType[] = ["human", "agent", "system", "tool"];
const ACTIONS: readonly DecisionSemanticAction[] = [
  "proposed",
  "edited",
  "approved",
  "rejected",
  "questioned",
  "deferred",
  "executed",
  "validated",
  "signed_off",
  "overridden",
  "retried",
];
const AUTHORITY_LEVELS: readonly DecisionAuthorityLevel[] = [
  "suggest",
  "draft",
  "apply_with_confirmation",
  "auto_execute",
];
const STATES: readonly DecisionState[] = [
  "draft",
  "proposed",
  "under_review",
  "approved",
  "executed",
  "verified",
  "rejected",
  "failed",
  "superseded",
];
const EVIDENCE_KINDS: readonly EvidenceKind[] = ["stage", "feedback", "attachment", "rule", "run"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && options.includes(value as T);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readEvidence(value: unknown): DecisionEvidence | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const label = stringValue(value.label);
  if (!id || !label || !isOneOf(value.kind, EVIDENCE_KINDS)) return null;
  return {
    id,
    kind: value.kind,
    label,
    excerpt: stringValue(value.excerpt) || undefined,
    href: stringValue(value.href) || undefined,
    version: stringValue(value.version) || undefined,
  };
}

function readEvent(value: unknown): DecisionEvent | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const actorId = stringValue(value.actorId);
  const actorName = stringValue(value.actorName);
  const objectRef = stringValue(value.objectRef);
  const permissionSnapshot = stringValue(value.permissionSnapshot);
  const timestamp = stringValue(value.timestamp);
  if (
    !id ||
    !actorId ||
    !actorName ||
    !objectRef ||
    !permissionSnapshot ||
    !timestamp ||
    !isOneOf(value.actorType, ACTOR_TYPES) ||
    !isOneOf(value.action, ACTIONS) ||
    !isOneOf(value.afterState, STATES)
  ) {
    return null;
  }
  return {
    id,
    actorType: value.actorType,
    actorId,
    actorName,
    action: value.action,
    objectRef,
    beforeState: isOneOf(value.beforeState, STATES) ? value.beforeState : undefined,
    afterState: value.afterState,
    evidenceRefs: stringArray(value.evidenceRefs),
    permissionSnapshot,
    rationale: stringValue(value.rationale) || undefined,
    timestamp,
  };
}

export function decisionArtifactId(feedbackId: string, suggestionIndex: number): string {
  return `decision:${feedbackId}:${suggestionIndex}`;
}

export function parseDecisionArtifact(value: unknown): DecisionArtifact | null {
  if (!isRecord(value)) return null;
  const id = stringValue(value.id);
  const projectId = stringValue(value.projectId);
  const subjectRef = stringValue(value.subjectRef);
  const title = stringValue(value.title);
  const proposal = stringValue(value.proposal);
  const originalProposal = stringValue(value.originalProposal);
  const sourceFeedbackId = stringValue(value.sourceFeedbackId);
  const createdAt = stringValue(value.createdAt);
  const updatedAt = stringValue(value.updatedAt);
  if (
    !id ||
    !projectId ||
    !subjectRef ||
    !title ||
    !proposal ||
    !originalProposal ||
    !sourceFeedbackId ||
    !createdAt ||
    !updatedAt ||
    !isOneOf(value.authorityLevel, AUTHORITY_LEVELS) ||
    !isOneOf(value.state, STATES)
  ) {
    return null;
  }

  return {
    id,
    projectId,
    subjectRef,
    stage: Math.max(1, Math.round(numberValue(value.stage, 1))),
    version: Math.max(1, Math.round(numberValue(value.version, 1))),
    title,
    proposal,
    originalProposal,
    humanRevision: stringValue(value.humanRevision) || undefined,
    reasonSummaries: stringArray(value.reasonSummaries),
    evidence: Array.isArray(value.evidence)
      ? value.evidence.map(readEvidence).filter((item): item is DecisionEvidence => item !== null)
      : [],
    assumptions: stringArray(value.assumptions),
    uncertainties: stringArray(value.uncertainties),
    impacts: stringArray(value.impacts),
    authorityLevel: value.authorityLevel,
    state: value.state,
    sourceFeedbackId,
    sourceSuggestionIndex: Math.max(0, Math.round(numberValue(value.sourceSuggestionIndex, 0))),
    supersedesRef: stringValue(value.supersedesRef) || undefined,
    validationFeedbackId: stringValue(value.validationFeedbackId) || undefined,
    events: Array.isArray(value.events)
      ? value.events.map(readEvent).filter((item): item is DecisionEvent => item !== null)
      : [],
    createdAt,
    updatedAt,
  };
}

export function parseDecisionArtifacts(stageData: Record<string, unknown> | undefined): DecisionArtifact[] {
  const raw = stageData?.[DECISION_ARTIFACTS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseDecisionArtifact)
    .filter((item): item is DecisionArtifact => item !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function withDecisionArtifacts(
  stageData: Record<string, unknown>,
  artifacts: DecisionArtifact[],
): Record<string, unknown> {
  return { ...stageData, [DECISION_ARTIFACTS_KEY]: artifacts };
}

export function buildDecisionArtifact(seed: DecisionSeed): DecisionArtifact {
  const id = decisionArtifactId(seed.feedbackId, seed.suggestionIndex);
  const evidenceRefs = seed.evidence.map((item) => item.id);
  const proposedEvent: DecisionEvent = {
    id: `${id}:event:proposed`,
    actorType: "agent",
    actorId: seed.agentId ?? "agent:coach",
    actorName: seed.agentName ?? "AI 导师 Coach",
    action: "proposed",
    objectRef: id,
    afterState: "proposed",
    evidenceRefs,
    permissionSnapshot: "Agent 仅可建议；不能替用户批准、提交或执行外部动作。",
    timestamp: seed.createdAt,
  };

  return {
    id,
    projectId: seed.projectId,
    subjectRef: seed.subjectRef,
    stage: seed.stage,
    version: 1,
    title: seed.title,
    proposal: seed.proposal,
    originalProposal: seed.proposal,
    reasonSummaries: seed.reasons.filter(Boolean).slice(0, 3),
    evidence: seed.evidence,
    assumptions: (seed.assumptions ?? []).filter(Boolean).slice(0, 4),
    uncertainties: (seed.uncertainties ?? []).filter(Boolean).slice(0, 4),
    impacts: (seed.impacts ?? []).filter(Boolean).slice(0, 4),
    authorityLevel: seed.authorityLevel ?? "suggest",
    state: "proposed",
    sourceFeedbackId: seed.feedbackId,
    sourceSuggestionIndex: seed.suggestionIndex,
    events: [proposedEvent],
    createdAt: seed.createdAt,
    updatedAt: seed.createdAt,
  };
}

function nextEvent(
  artifact: DecisionArtifact,
  input: ApplyDecisionIntentInput,
  action: DecisionSemanticAction,
  afterState: DecisionState,
  suffix: string,
  rationale?: string,
): DecisionEvent {
  return {
    id: `${artifact.id}:event:${artifact.version + 1}:${suffix}`,
    actorType: input.actor.type,
    actorId: input.actor.id,
    actorName: input.actor.name,
    action,
    objectRef: artifact.id,
    beforeState: artifact.state,
    afterState,
    evidenceRefs: artifact.evidence.map((item) => item.id),
    permissionSnapshot:
      input.actor.type === "human"
        ? "项目成员可修改、批准、质疑、暂缓和签收；系统不会自动提交作品。"
        : input.actor.type === "agent"
          ? "Agent 仅执行复核并记录结果；没有最终决策权。"
          : "系统仅按已确认动作写入当前阶段 Artifact。",
    rationale: rationale?.trim() || undefined,
    timestamp: input.timestamp,
  };
}

export function applyDecisionIntent(input: ApplyDecisionIntentInput): DecisionArtifact {
  const { artifact, intent } = input;
  const next: DecisionArtifact = {
    ...artifact,
    evidence: [...artifact.evidence],
    reasonSummaries: [...artifact.reasonSummaries],
    assumptions: [...artifact.assumptions],
    uncertainties: [...artifact.uncertainties],
    impacts: [...artifact.impacts],
    events: [...artifact.events],
    version: artifact.version + 1,
    updatedAt: input.timestamp,
  };

  if (intent === "approve") {
    next.state = "executed";
    next.events.push(
      nextEvent(artifact, input, "approved", "approved", "approved", input.rationale),
      nextEvent(artifact, { ...input, actor: { id: "system", name: "系统", type: "system" } }, "executed", "executed", "executed"),
    );
    return next;
  }

  if (intent === "modify") {
    const revision = input.modifiedProposal?.trim();
    if (!revision) throw new Error("修改后的提议不能为空");
    next.proposal = revision;
    next.humanRevision = revision;
    next.state = "executed";
    next.events.push(
      nextEvent(artifact, input, "edited", "under_review", "edited", input.rationale),
      nextEvent(artifact, input, "approved", "approved", "approved-revision", input.rationale),
      nextEvent(artifact, { ...input, actor: { id: "system", name: "系统", type: "system" } }, "executed", "executed", "executed-revision"),
    );
    return next;
  }

  if (intent === "question") {
    next.state = "under_review";
    next.events.push(nextEvent(artifact, input, "questioned", "under_review", "questioned", input.rationale));
    return next;
  }

  if (intent === "defer") {
    next.state = "under_review";
    next.events.push(nextEvent(artifact, input, "deferred", "under_review", "deferred", input.rationale));
    return next;
  }

  if (intent === "validate") {
    next.validationFeedbackId = input.validationFeedbackId;
    next.state = artifact.state === "verified" ? "verified" : "executed";
    next.events.push(nextEvent(artifact, input, "validated", next.state, "validated", input.rationale));
    return next;
  }

  next.state = "verified";
  next.events.push(nextEvent(artifact, input, "signed_off", "verified", "signed-off", input.rationale));
  return next;
}

export function upsertDecisionArtifact(
  artifacts: DecisionArtifact[],
  artifact: DecisionArtifact,
): DecisionArtifact[] {
  const withoutCurrent = artifacts.filter((item) => item.id !== artifact.id);
  return [artifact, ...withoutCurrent].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function findDecisionArtifact(
  artifacts: DecisionArtifact[],
  feedbackId: string,
  suggestionIndex: number,
): DecisionArtifact | undefined {
  const id = decisionArtifactId(feedbackId, suggestionIndex);
  return artifacts.find((item) => item.id === id);
}

export function hasValidationEvent(artifact: DecisionArtifact): boolean {
  return artifact.events.some((event) => event.action === "validated");
}

export function decisionStateLabel(state: DecisionState): string {
  const labels: Record<DecisionState, string> = {
    draft: "草稿",
    proposed: "Agent 提议待处理",
    under_review: "复核中",
    approved: "已批准",
    executed: "已写入 Artifact",
    verified: "已签收",
    rejected: "已驳回",
    failed: "执行失败",
    superseded: "已被新版本替代",
  };
  return labels[state];
}

export function decisionActionLabel(action: DecisionSemanticAction): string {
  const labels: Record<DecisionSemanticAction, string> = {
    proposed: "提议",
    edited: "修改",
    approved: "批准",
    rejected: "驳回",
    questioned: "质疑依据",
    deferred: "暂缓",
    executed: "写入 Artifact",
    validated: "复核",
    signed_off: "签收",
    overridden: "人工覆盖",
    retried: "重试",
  };
  return labels[action];
}

export function intentAuditAction(intent: DecisionIntent): string {
  return `decision.${intent}`;
}

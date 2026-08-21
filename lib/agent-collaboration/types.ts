export const DECISION_ARTIFACTS_KEY = "__decisionArtifacts" as const;

export type CollaborationActorType = "human" | "agent" | "system" | "tool";

export type DecisionSemanticAction =
  | "proposed"
  | "edited"
  | "approved"
  | "rejected"
  | "questioned"
  | "deferred"
  | "executed"
  | "validated"
  | "signed_off"
  | "overridden"
  | "retried";

export type DecisionAuthorityLevel =
  | "suggest"
  | "draft"
  | "apply_with_confirmation"
  | "auto_execute";

export type DecisionState =
  | "draft"
  | "proposed"
  | "under_review"
  | "approved"
  | "executed"
  | "verified"
  | "rejected"
  | "failed"
  | "superseded";

export type DecisionIntent =
  | "approve"
  | "modify"
  | "question"
  | "defer"
  | "validate"
  | "signoff";

export type EvidenceKind =
  | "stage"
  | "feedback"
  | "attachment"
  | "rule"
  | "run";

export interface DecisionEvidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  excerpt?: string;
  href?: string;
  version?: string;
}

export interface DecisionEvent {
  id: string;
  actorType: CollaborationActorType;
  actorId: string;
  actorName: string;
  action: DecisionSemanticAction;
  objectRef: string;
  beforeState?: DecisionState;
  afterState: DecisionState;
  evidenceRefs: string[];
  permissionSnapshot: string;
  rationale?: string;
  timestamp: string;
}

export interface DecisionArtifact {
  id: string;
  projectId: string;
  subjectRef: string;
  stage: number;
  version: number;

  title: string;
  proposal: string;
  originalProposal: string;
  humanRevision?: string;
  reasonSummaries: string[];
  evidence: DecisionEvidence[];
  assumptions: string[];
  uncertainties: string[];
  impacts: string[];

  authorityLevel: DecisionAuthorityLevel;
  state: DecisionState;
  sourceFeedbackId: string;
  sourceSuggestionIndex: number;
  supersedesRef?: string;
  validationFeedbackId?: string;

  events: DecisionEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface DecisionSeed {
  projectId: string;
  subjectRef: string;
  stage: number;
  title: string;
  proposal: string;
  reasons: string[];
  evidence: DecisionEvidence[];
  assumptions?: string[];
  uncertainties?: string[];
  impacts?: string[];
  authorityLevel?: DecisionAuthorityLevel;
  feedbackId: string;
  suggestionIndex: number;
  agentId?: string;
  agentName?: string;
  createdAt: string;
}

export interface DecisionActor {
  id: string;
  name: string;
  type: CollaborationActorType;
}

export interface ApplyDecisionIntentInput {
  artifact: DecisionArtifact;
  intent: DecisionIntent;
  actor: DecisionActor;
  timestamp: string;
  rationale?: string;
  modifiedProposal?: string;
  validationFeedbackId?: string;
}

export interface DecisionRunTrace {
  feedbackId: string;
  provider: string;
  model: string;
  promptVersionLabel?: string | null;
  status: string;
  latencyMs: number;
  createdAt: string;
}

export interface DecisionActionRequest {
  step: number;
  feedbackId: string;
  suggestionIndex: number;
  intent: DecisionIntent;
  rationale?: string;
  modifiedProposal?: string;
  validationFeedbackId?: string;
}

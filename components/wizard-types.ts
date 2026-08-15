// 向导客户端共享类型(全部为可序列化的纯数据)

export interface TestCaseRow {
  id?: string;
  name: string;
  type: "NORMAL" | "BOUNDARY" | "FAILURE" | "NA";
  input: string;
  expected: string;
  actual: string;
  verdict: "PENDING" | "PASS" | "FAIL" | "NA";
  manualFix: string;
  failureReason: string;
}

export interface FeedbackItem {
  id: string;
  step: number;
  purpose: string;
  content: {
    stage_assessment: string;
    summary: string;
    critical_gaps: { field: string; reason: string }[];
    questions: string[];
    suggestions: { title: string; action: string; why: string }[];
    risk_flags: { type: string; severity: string; message: string }[];
    next_action: string;
    can_continue: boolean;
    precheck_scores: null | {
      problem_definition: number;
      originality: number;
      closed_loop: number;
      evidence: number;
      total: number;
      note: string;
    };
    raw_feedback?: string;
  };
  suggestionStates: Record<string, string>;
  createdAt: string;
}

export interface WizardTeam {
  id: string;
  name: string;
  mode: string;
  inviteCode: string;
  startTime: string | null;
  existingBase: string | null;
  addedDuringActivity: string | null;
  externalResources: string | null;
  helpers: string | null;
  members: { name: string; seatRole: string }[];
}

export interface AttachmentItem {
  id: string;
  kind: string; // LINK | FILE
  title: string;
  url: string;
  sizeKb: number | null;
}

export interface WizardData {
  projectId: string;
  title: string;
  track: string | null;
  status: string;
  currentStep: number;
  returnReason: string | null;
  readOnly: boolean;
  isMember: boolean;
  team: WizardTeam;
  stages: Record<number, Record<string, unknown>>;
  testCases: TestCaseRow[];
  feedbacks: FeedbackItem[];
  snapshots: { version: number; createdAt: string }[];
  attachments: AttachmentItem[];
}

export interface HardRuleView {
  code: string;
  label: string;
  passed: boolean;
  message: string;
  fix: string;
}

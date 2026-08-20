export interface TestRecordSummary {
  hasDocumentedFailure: boolean;
  hasNotApplicableRecord: boolean;
}

const REVIEW_PENDING_STATUSES = new Set(["SUBMITTED", "PRELIMINARY", "FINAL"]);

export function evidenceGapCandidate({
  status,
  blocker,
  nextHint,
}: {
  status: string;
  blocker?: string;
  nextHint?: string;
}): string {
  if (REVIEW_PENDING_STATUSES.has(status)) {
    return "提交后的证据缺口尚待人工复核；平台当前不自动判定。";
  }
  return blocker || nextHint || "尚未形成可核对的缺口记录。";
}

export function summarizeTestRecords(
  testCases: { verdict?: string; failureReason?: string }[],
): TestRecordSummary {
  return {
    hasDocumentedFailure: testCases.some(
      (testCase) =>
        testCase.verdict === "FAIL" && Boolean(testCase.failureReason?.trim()),
    ),
    hasNotApplicableRecord: testCases.some(
      (testCase) => testCase.verdict === "NA",
    ),
  };
}

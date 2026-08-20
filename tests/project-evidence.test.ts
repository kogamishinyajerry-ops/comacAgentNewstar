import { describe, expect, it } from "vitest";
import {
  evidenceGapCandidate,
  summarizeTestRecords,
} from "../lib/project-evidence";

describe("项目证据记录摘要", () => {
  it.each([
    {
      name: "普通案例的真实失败",
      testCases: [{ type: "NORMAL", verdict: "FAIL", failureReason: "结果与预期不一致" }],
      expected: { hasDocumentedFailure: true, hasNotApplicableRecord: false },
    },
    {
      name: "不适用案例单独记录",
      testCases: [{ type: "NA", verdict: "NA", failureReason: "当前场景不适用" }],
      expected: { hasDocumentedFailure: false, hasNotApplicableRecord: true },
    },
    {
      name: "失败类型但实际通过",
      testCases: [{ type: "FAILURE", verdict: "PASS", failureReason: "系统正确拦截" }],
      expected: { hasDocumentedFailure: false, hasNotApplicableRecord: false },
    },
  ])("按 verdict 区分 $name", ({ testCases, expected }) => {
    expect(summarizeTestRecords(testCases)).toEqual(expected);
  });
});

describe("项目证据候选缺口", () => {
  it.each(["SUBMITTED", "PRELIMINARY", "FINAL"])(
    "%s 状态等待人工复核，不把流程状态冒充缺口",
    (status) => {
      expect(
        evidenceGapCandidate({
          status,
          blocker: "",
          nextHint: "已提交，等待组织者处理",
        }),
      ).toBe("提交后的证据缺口尚待人工复核；平台当前不自动判定。");
    },
  );
});

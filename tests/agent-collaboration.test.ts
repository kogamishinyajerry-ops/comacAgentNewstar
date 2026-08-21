import { describe, expect, it } from "vitest";
import {
  applyDecisionIntent,
  buildDecisionArtifact,
  decisionArtifactId,
  findDecisionArtifact,
  hasValidationEvent,
  parseDecisionArtifacts,
  upsertDecisionArtifact,
  withDecisionArtifacts,
} from "../lib/agent-collaboration/decision";
import type { DecisionArtifact, DecisionSeed } from "../lib/agent-collaboration/types";

const seed: DecisionSeed = {
  projectId: "project-1",
  subjectRef: "project:project-1:stage:4",
  stage: 4,
  title: "缩小问题边界",
  proposal: "先把目标收敛为一个可验证的会议待办闭环。",
  reasons: ["当前范围无法在一个月内验证", "评审需要可观察的成功标准"],
  evidence: [
    {
      id: "stage:project-1:4",
      kind: "stage",
      label: "问题定义 Artifact",
      excerpt: "帮助所有同事提高效率",
    },
    {
      id: "feedback:feedback-1",
      kind: "feedback",
      label: "AI 导师诊断",
    },
  ],
  assumptions: ["尚未确认真实用户是否愿意试用"],
  uncertainties: ["当前没有可量化基线"],
  impacts: ["只写入当前阶段决策记录", "不自动提交或执行外部动作"],
  feedbackId: "feedback-1",
  suggestionIndex: 0,
  createdAt: "2026-08-21T10:00:00.000Z",
};

function initial(): DecisionArtifact {
  return buildDecisionArtifact(seed);
}

describe("agent collaboration decision ontology", () => {
  it("builds a proposed artifact with an explicit agent attribution event", () => {
    const artifact = initial();

    expect(artifact.id).toBe(decisionArtifactId("feedback-1", 0));
    expect(artifact.state).toBe("proposed");
    expect(artifact.authorityLevel).toBe("suggest");
    expect(artifact.events).toHaveLength(1);
    expect(artifact.events[0]).toMatchObject({
      actorType: "agent",
      action: "proposed",
      afterState: "proposed",
    });
  });

  it("preserves the agent proposal when a human commits an edited version", () => {
    const artifact = applyDecisionIntent({
      artifact: initial(),
      intent: "modify",
      actor: { id: "user-1", name: "严冬杰", type: "human" },
      timestamp: "2026-08-21T10:05:00.000Z",
      modifiedProposal: "先验证会议记录能否稳定提取三类待办，再生成可确认任务卡。",
      rationale: "把范围收敛到一个可演示闭环",
    });

    expect(artifact.originalProposal).toBe(seed.proposal);
    expect(artifact.proposal).toContain("三类待办");
    expect(artifact.humanRevision).toBe(artifact.proposal);
    expect(artifact.state).toBe("executed");
    expect(artifact.events.map((event) => event.action)).toEqual([
      "proposed",
      "edited",
      "approved",
      "executed",
    ]);
    expect(artifact.events.at(-1)?.actorType).toBe("system");
  });

  it("records a challenge without silently rejecting or approving the proposal", () => {
    const artifact = applyDecisionIntent({
      artifact: initial(),
      intent: "question",
      actor: { id: "user-1", name: "严冬杰", type: "human" },
      timestamp: "2026-08-21T10:06:00.000Z",
      rationale: "活动规则并没有要求所有项目都必须量化节省时间",
    });

    expect(artifact.state).toBe("under_review");
    expect(artifact.events.at(-1)).toMatchObject({
      action: "questioned",
      actorType: "human",
      rationale: "活动规则并没有要求所有项目都必须量化节省时间",
    });
  });

  it("requires an explicit validation event before the human sign-off can be represented", () => {
    const approved = applyDecisionIntent({
      artifact: initial(),
      intent: "approve",
      actor: { id: "user-1", name: "严冬杰", type: "human" },
      timestamp: "2026-08-21T10:07:00.000Z",
    });
    const validated = applyDecisionIntent({
      artifact: approved,
      intent: "validate",
      actor: { id: "agent:run-2", name: "AI 导师 Coach", type: "agent" },
      timestamp: "2026-08-21T10:08:00.000Z",
      validationFeedbackId: "feedback-2",
    });
    const signedOff = applyDecisionIntent({
      artifact: validated,
      intent: "signoff",
      actor: { id: "user-1", name: "严冬杰", type: "human" },
      timestamp: "2026-08-21T10:09:00.000Z",
    });

    expect(hasValidationEvent(validated)).toBe(true);
    expect(validated.validationFeedbackId).toBe("feedback-2");
    expect(signedOff.state).toBe("verified");
    expect(signedOff.events.at(-1)).toMatchObject({
      action: "signed_off",
      actorName: "严冬杰",
      afterState: "verified",
    });
  });

  it("round-trips valid artifacts through the reserved stage-data key and drops malformed rows", () => {
    const artifact = initial();
    const stage = withDecisionArtifacts(
      { targetUser: "活动参与者" },
      [artifact, { broken: true } as unknown as DecisionArtifact],
    );

    const parsed = parseDecisionArtifacts(stage);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe(artifact.id);
    expect(stage.targetUser).toBe("活动参与者");
  });

  it("upserts one semantic decision without duplicating its identity", () => {
    const first = initial();
    const changed = { ...first, version: 2, updatedAt: "2026-08-21T10:10:00.000Z" };
    const artifacts = upsertDecisionArtifact([first], changed);

    expect(artifacts).toHaveLength(1);
    expect(findDecisionArtifact(artifacts, "feedback-1", 0)?.version).toBe(2);
  });
});

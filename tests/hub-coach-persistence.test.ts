// §35:Coach 会话持久化(sessionStorage 快照的序列化/校验/恢复,纯函数)
import { describe, expect, it } from "vitest";
import {
  COACH_FLOW_STORAGE_VERSION,
  coachFlowStorageKey,
  isCoachAct,
  restoreCoachFlowSnapshot,
  serializeCoachFlow,
  settleTransientPhase,
  type CoachFlowSnapshot,
} from "../lib/hub/coach-persistence";
import {
  ACT_COUNT,
  ARTIFACT_ROUND_COUNT,
  advance,
  beginCoach,
  createCoachState,
  startArtifact,
  submitAnswer,
  type CoachState,
} from "../lib/hub/coach-machine";
import { coachDemoActs, coachDemoArtifactActs, type CoachEntry } from "../fixtures/coach-demo";

const ENTRY: CoachEntry = "problem";

function snapshotFor(state: CoachState, overrides: Partial<CoachFlowSnapshot> = {}): CoachFlowSnapshot {
  return {
    version: COACH_FLOW_STORAGE_VERSION,
    entry: ENTRY,
    state,
    remoteActs: {},
    artifactRemoteActs: {},
    answer: "",
    cardId: "QD-T3ST5",
    seedAt: null,
    artifactAt: null,
    beginCount: 0,
    ...overrides,
  };
}

/** 已答 n 幕并落定到稳定相位的问题态(n < ACT_COUNT) */
function answeredState(n: number, entry: CoachEntry = ENTRY): CoachState {
  let state = beginCoach(createCoachState(entry));
  for (let i = 0; i < n; i += 1) {
    state = advance(submitAnswer(state, `第 ${i + 1} 幕的真实回答,带有足够上下文。`));
  }
  return state;
}

describe("coach-persistence:键与版本", () => {
  it("键含版本与入口,problem/idea 各自独立", () => {
    expect(coachFlowStorageKey("problem")).toBe("coach-flow:v1:problem");
    expect(coachFlowStorageKey("idea")).toBe("coach-flow:v1:idea");
    expect(coachFlowStorageKey("problem")).not.toBe(coachFlowStorageKey("idea"));
  });
});

describe("coach-persistence:往返一致", () => {
  it("稳定相位全序列(建立拍/问题态/种子/深化轮/完成)序列化→恢复后深相等", () => {
    const intro = createCoachState(ENTRY);
    const question = answeredState(1);
    const seed = advance(submitAnswer(answeredState(ACT_COUNT - 1), "末幕回答,凝结前的最后一笔。"));
    expect(seed.phase).toBe("seed");
    const artifactQuestion = startArtifact(seed);
    expect(artifactQuestion.phase).toBe("artifact-question");
    let deepened = artifactQuestion;
    for (let i = 0; i < ARTIFACT_ROUND_COUNT; i += 1) {
      deepened = advance(submitAnswer(deepened, `深化第 ${i + 1} 轮的回答。`));
    }
    expect(deepened.phase).toBe("artifact-done");

    const stamp = "2026-08-21T02:00:00.000Z";
    const cases: CoachFlowSnapshot[] = [
      snapshotFor(intro),
      snapshotFor(question, { answer: "未提交的草稿", beginCount: 1 }),
      snapshotFor(question, {
        remoteActs: { 1: coachDemoActs.problem[1] },
        beginCount: 1,
      }),
      snapshotFor(seed, { seedAt: stamp, beginCount: 1 }),
      snapshotFor(artifactQuestion, { seedAt: stamp, beginCount: 1 }),
      snapshotFor(deepened, {
        seedAt: stamp,
        artifactAt: stamp,
        artifactRemoteActs: { 1: coachDemoArtifactActs[1] },
        beginCount: 1,
      }),
    ];
    for (const snapshot of cases) {
      expect(restoreCoachFlowSnapshot(serializeCoachFlow(snapshot), ENTRY)).toEqual(snapshot);
    }
  });

  it("idea 入口快照在 problem 键下恢复被拒绝(entry 不符)", () => {
    const ideaSnapshot = snapshotFor(beginCoach(createCoachState("idea")), { entry: "idea" });
    expect(restoreCoachFlowSnapshot(serializeCoachFlow(ideaSnapshot), "problem")).toBeNull();
    expect(restoreCoachFlowSnapshot(serializeCoachFlow(ideaSnapshot), "idea")).not.toBeNull();
  });
});

describe("coach-persistence:transient 相位落定", () => {
  it("transition(幕间在途)恢复时用 advance() 落定到下一幕问题态", () => {
    const transient = submitAnswer(answeredState(1), "第二幕回答,提交后页面即离开。");
    expect(transient.phase).toBe("transition");
    const restored = restoreCoachFlowSnapshot(serializeCoachFlow(snapshotFor(transient)), ENTRY);
    expect(restored).not.toBeNull();
    expect(restored!.state).toEqual(advance(transient));
    expect(restored!.state.phase).toBe("question");
    expect(restored!.state.actIndex).toBe(2);
  });

  it("末幕 transition 恢复后落定到种子态;深化在途落定到下一轮", () => {
    const finalTransient = submitAnswer(answeredState(ACT_COUNT - 1), "末幕回答。");
    expect(finalTransient.phase).toBe("transition");
    const settledSeed = restoreCoachFlowSnapshot(
      serializeCoachFlow(snapshotFor(finalTransient)),
      ENTRY,
    );
    expect(settledSeed!.state.phase).toBe("seed");

    const artifactTransient = submitAnswer(startArtifact(settledSeed!.state), "深化第一轮回答。");
    expect(artifactTransient.phase).toBe("artifact-transition");
    const settledRound = restoreCoachFlowSnapshot(
      serializeCoachFlow(snapshotFor(artifactTransient)),
      ENTRY,
    );
    expect(settledRound!.state.phase).toBe("artifact-question");
    expect(settledRound!.state.artifactRound).toBe(1);
    /* settleTransientPhase 幂等:稳定相位原样返回 */
    expect(settleTransientPhase(settledRound!.state)).toBe(settledRound!.state);
  });
});

describe("coach-persistence:损坏即整体回退(返回 null)", () => {
  const valid = serializeCoachFlow(snapshotFor(answeredState(1), { beginCount: 1 }));

  function tampered(mutate: (snapshot: Record<string, unknown>) => void): string {
    const parsed = JSON.parse(valid) as Record<string, unknown>;
    mutate(parsed);
    return JSON.stringify(parsed);
  }

  it("空值/非 JSON/非对象一律拒绝", () => {
    expect(restoreCoachFlowSnapshot(null, ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot("not-json{", ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot('"just a string"', ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot("[]", ENTRY)).toBeNull();
  });

  it("版本不符拒绝(结构演进即换键,旧快照自然失效)", () => {
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.version = 0; }), ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.version = 99; }), ENTRY)).toBeNull();
  });

  it("相位—进度不变量破坏拒绝(不做局部修复)", () => {
    /* question 相位要求 answers.length === actIndex */
    expect(
      restoreCoachFlowSnapshot(
        tampered((s) => { (s.state as Record<string, unknown>).actIndex = 2; }),
        ENTRY,
      ),
    ).toBeNull();
    /* 未知相位 */
    expect(
      restoreCoachFlowSnapshot(
        tampered((s) => { (s.state as Record<string, unknown>).phase = "limbo"; }),
        ENTRY,
      ),
    ).toBeNull();
    /* 答案含空白串 */
    expect(
      restoreCoachFlowSnapshot(
        tampered((s) => { (s.state as Record<string, unknown>).answers = ["   "]; }),
        ENTRY,
      ),
    ).toBeNull();
  });

  it("live 幕次表形状非法拒绝(缺字段/越界幕下标)", () => {
    expect(
      restoreCoachFlowSnapshot(
        tampered((s) => { s.remoteActs = { 1: { judgment: "只有一字段" } }; }),
        ENTRY,
      ),
    ).toBeNull();
    expect(
      restoreCoachFlowSnapshot(
        tampered((s) => { s.remoteActs = { 9: coachDemoActs.problem[0] }; }),
        ENTRY,
      ),
    ).toBeNull();
  });

  it("卡号/时间戳/草稿/焦点信号形状非法拒绝", () => {
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.cardId = ""; }), ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.seedAt = "不是时间"; }), ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.answer = 42; }), ENTRY)).toBeNull();
    expect(restoreCoachFlowSnapshot(tampered((s) => { s.beginCount = -1; }), ENTRY)).toBeNull();
  });
});

describe("coach-persistence:CoachAct 形状守卫", () => {
  it("与请求校验同源:五字段非空且 ≤600 字", () => {
    expect(isCoachAct(coachDemoActs.problem[0])).toBe(true);
    expect(isCoachAct(null)).toBe(false);
    expect(isCoachAct({ ...coachDemoActs.problem[0], question: "" })).toBe(false);
    expect(isCoachAct({ ...coachDemoActs.problem[0], risk: "x".repeat(601) })).toBe(false);
  });
});

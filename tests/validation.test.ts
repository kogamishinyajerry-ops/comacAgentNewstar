import { describe, expect, it } from "vitest";
import {
  closedLoopComplete,
  rulesAgreed,
  scanSensitiveText,
  validateStageData,
  validateTestCases,
  validateTeamDisclosure,
} from "../lib/validation";

const stagesOf = (map: Record<number, Record<string, unknown>>) =>
  Object.entries(map).map(([step, data]) => ({ step: Number(step), data: JSON.stringify(data) }));

describe("validateStageData", () => {
  it("第1步三项勾选缺一不可", () => {
    const errors = validateStageData(1, { agreeRules: true, agreeDataSafety: true, agreeOriginality: false });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("agreeOriginality");
  });

  it("第4步必填字段缺失时给出中文原因", () => {
    const errors = validateStageData(4, { targetUser: "新员工", scenario: "" });
    expect(errors.some((e) => e.field === "scenario")).toBe(true);
    expect(errors[0].reason).toContain("必填");
  });

  it("填写完整时无错误", () => {
    const full: Record<string, unknown> = {
      targetUser: "a", scenario: "b", frequency: "c", currentProcess: "d",
      worstStep: "e", currentCost: "f", whyWorth: "g",
    };
    expect(validateStageData(4, full)).toHaveLength(0);
  });
});

describe("求证闭环红线", () => {
  it("五要素齐备才算闭环", () => {
    const ok = stagesOf({
      5: { judgmentSource: "以导出原始记录为准", stopConditions: "行数对不上即停" },
      6: { autoCheckScope: "数量一致、日期合法", humanConfirmPoint: "发出前确认", finalOwner: "本人" },
    });
    expect(closedLoopComplete(ok)).toBe(true);
  });

  it("缺少人工确认点时不通过", () => {
    const bad = stagesOf({
      5: { judgmentSource: "x", stopConditions: "y" },
      6: { autoCheckScope: "z", humanConfirmPoint: "", finalOwner: "me" },
    });
    expect(closedLoopComplete(bad)).toBe(false);
  });
});

describe("测试案例覆盖", () => {
  const mk = (type: string) => ({ name: "c", type, input: "i", expected: "e" });

  it("少于5例报错", () => {
    const r = validateTestCases([mk("NORMAL"), mk("BOUNDARY"), mk("FAILURE")]);
    expect(r.countOk).toBe(false);
    expect(r.errors[0].reason).toContain("5");
  });

  it("缺少失败或不适用案例时提示", () => {
    const r = validateTestCases([mk("NORMAL"), mk("NORMAL"), mk("BOUNDARY"), mk("BOUNDARY"), mk("NORMAL")]);
    expect(r.coverageOk).toBe(false);
    expect(r.errors.some((e) => e.reason.includes("失败或不适用"))).toBe(true);
  });

  it("三类齐备且5例通过", () => {
    const r = validateTestCases([mk("NORMAL"), mk("NORMAL"), mk("BOUNDARY"), mk("BOUNDARY"), mk("FAILURE")]);
    expect(r.errors).toHaveLength(0);
    expect(r.coverageOk).toBe(true);
  });
});

describe("敏感信息扫描", () => {
  it("识别明文密钥与身份证号", () => {
    const hits = scanSensitiveText("我的key是 sk-abcdefgh1234567890 身份证 110101199003077777");
    expect(hits.some((h) => h.includes("API密钥"))).toBe(true);
    expect(hits.some((h) => h.includes("身份证"))).toBe(true);
  });

  it("识别内网地址但放过公网域名", () => {
    expect(scanSensitiveText("访问 http://10.3.4.5:8080/api")).not.toHaveLength(0);
    expect(scanSensitiveText("访问 https://example.com/path")).toHaveLength(0);
  });
});

describe("原创披露", () => {
  it("五项披露缺一不可", () => {
    const errors = validateTeamDisclosure({
      startTime: "2026-08", existingBase: "无", addedDuringActivity: "全部", externalResources: "", helpers: "无",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe("externalResources");
  });
});

describe("第1步合规勾选", () => {
  it("全部勾选才通过", () => {
    expect(rulesAgreed(stagesOf({ 1: { agreeRules: true, agreeDataSafety: true, agreeOriginality: true } }))).toBe(true);
    expect(rulesAgreed(stagesOf({ 1: { agreeRules: true, agreeDataSafety: false, agreeOriginality: true } }))).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { buildArtPrompt, mockArtSvg, hashSeedForTest } from "../lib/minimax";

describe("buildArtPrompt", () => {
  it("各场景生成差异化提示词且包含风格约束", () => {
    const submit = buildArtPrompt({ scene: "submit", title: "变更对比小助手" });
    const step4 = buildArtPrompt({ scene: "step-4", title: "规章问答", track: "知识问答助手" });
    expect(submit).toContain("庆祝场景");
    expect(submit).toContain("变更对比小助手");
    expect(step4).toContain("知识问答助手");
    expect(submit).toContain("扁平矢量插画");
    expect(submit).not.toContain("undefined");
  });

  it("缺省字段不产生undefined/null字样", () => {
    const p = buildArtPrompt({ scene: "achievement-x" });
    expect(p).not.toMatch(/undefined|null/);
  });
});

describe("mockArtSvg 离线艺术", () => {
  it("生成合法SVG(可作data URL)", () => {
    const svg = mockArtSvg("测试提示词");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    expect(() => decodeURIComponent(svg)).not.toThrow();
  });

  it("同提示词确定性输出,不同提示词产生差异", () => {
    expect(mockArtSvg("abc")).toBe(mockArtSvg("abc"));
    expect(mockArtSvg("abc")).not.toBe(mockArtSvg("abd"));
  });

  it("种子哈希稳定", () => {
    expect(hashSeedForTest("hello")).toBe(hashSeedForTest("hello"));
    expect(hashSeedForTest("hello")).not.toBe(hashSeedForTest("world"));
  });
});

// 阶段一:配置红线——未确认的活动事实必须保持待确认,不得编造
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_LOGO_PATH_WHITELIST,
  activity,
  activityFact,
  activityTimeline,
  approvedActivityLogoPath,
  journeySteps,
  platformBoundaries,
  roles,
  PENDING_LABEL,
} from "../config/activity";
import { site } from "../config/site";
import { coachDemoActs, coachPrivacyNotice, seedCopy } from "../fixtures/coach-demo";

describe("config/activity:活动事实待确认", () => {
  it("日期与链接未确认时为 null", () => {
    expect(activity.status).toBe("configuration_pending");
    expect(activity.dates.startDate).toBeNull();
    expect(activity.dates.endDate).toBeNull();
    expect(activity.dates.registrationDeadline).toBeNull();
    expect(activity.links.registration).toBeNull();
    expect(activity.links.login).toBeNull();
  });

  it("未确认事实统一显示兜底文案", () => {
    expect(activityFact(null)).toBe(PENDING_LABEL);
    expect(activityFact("  ")).toBe(PENDING_LABEL);
    expect(activityFact("2026-09-01")).toBe("2026-09-01");
    const t = activityTimeline();
    expect(t.start).toBe(PENDING_LABEL);
    expect(t.deadline).toBe(PENDING_LABEL);
  });

  it("主办方列表为空(未获正式写法),Logo 未授权时只用文字标识", () => {
    expect(activity.organizers).toHaveLength(0);
    expect(activity.brand.approvedLogoPath).toBeNull();
    expect(activity.brand.useTextMarkUntilApproved).toBe(true);
    expect(ACTIVITY_LOGO_PATH_WHITELIST).toEqual([]);
    expect(approvedActivityLogoPath).toBeNull();
    expect(Object.values(activity.rules)).toEqual([null, null, null, null, null, null, null]);
  });
});

describe("config/site:导航与首屏", () => {
  it("活动身份只从 activity 配置单向派生", () => {
    expect(site.title).toBe(activity.identity.name);
    expect(site.brand.name).toBe(activity.identity.name);
    expect(site.brand.shortName).toBe(activity.identity.shortName);
  });

  it("主 CTA 指向可选沉浸式入口;导航均指向真实去处;hero 长卷文案已随死代码移除", () => {
    expect(site.primaryCta.href).toBe("/experience");
    expect(site.nav.length).toBeGreaterThan(0);
    expect("hero" in site).toBe(false);
  });

  it("固定视口主入口不再挂接已移除的长卷锚点", () => {
    const anchors = site.nav.map((n) => n.href);
    expect(anchors).toEqual(["/", "/guide", "/role/participant"]);
    expect(anchors.every((href) => !href.startsWith("/#"))).toBe(true);
  });

  it("FAQ 恰好五问且回答克制(2–4 句)", () => {
    expect(site.faq).toHaveLength(5);
    for (const item of site.faq) {
      const sentences = item.a.split(/[。!?]/).filter(Boolean).length;
      expect(sentences).toBeGreaterThanOrEqual(2);
      expect(sentences).toBeLessThanOrEqual(5);
    }
  });
});

describe("config/activity:叙事结构", () => {
  it("五段实践路径,覆盖问题→价值→必要性→构建→展示", () => {
    expect(journeySteps).toHaveLength(5);
    expect(journeySteps[3].title).toContain("外部工具");
    expect(journeySteps[4].title).toContain("证据");
  });

  it("三类角色,参赛者是主视觉;评委/组织者各有边界声明", () => {
    expect(roles).toHaveLength(3);
    const participant = roles.find((r) => r.key === "participant")!;
    expect(participant.primary).toBe(true);
    for (const r of roles) {
      expect(r.href).toBe(`/role/${r.key}`);
      expect(r.willSee.length).toBeGreaterThanOrEqual(2);
      expect(r.wontDo.length).toBeGreaterThanOrEqual(2);
    }
    expect(JSON.stringify(roles.find((r) => r.key === "reviewer"))).not.toContain("打分系统");
  });

  it("平台边界:负责五项,不负责含 Coding 与裁决", () => {
    expect(platformBoundaries.does).toHaveLength(5);
    expect(platformBoundaries.doesNot.join()).toContain("Coding");
    expect(platformBoundaries.doesNot.join()).toContain("替评委打分");
  });
});

describe("fixtures/coach-demo:种子文案", () => {
  it("种子 CTA 有真实去向,并明确说明 AI 服务与隐私边界", () => {
    expect(seedCopy.cta.href).toBe("/guide");
    expect(coachPrivacyNotice).toBe("回答不会保存为项目，但可能发送至 AI 服务；请勿输入保密、个人或未公开信息。");
    expect(seedCopy.previewNote).toContain(coachPrivacyNotice);
  });

  it("两条入口文案互不相同(不同起点的确定性路径)", () => {
    expect(coachDemoActs.problem[0].question).not.toBe(coachDemoActs.idea[0].question);
  });
});

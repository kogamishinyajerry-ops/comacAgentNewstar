import { describe, expect, it } from "vitest";
import {
  DEFAULT_PENDING_LABEL,
  resolveApprovedLogoPath,
  validateActivityConfig,
  type ActivityConfig,
} from "../lib/hub/activity-config";
import { ACTIVITY_LOGO_PATH_WHITELIST, activity } from "../config/activity";
import exampleActivityConfig from "../config/activity.example.json";

function configuredFixture(): ActivityConfig {
  return {
    identity: {
      name: "活动名称",
      shortName: "活动短名",
      eyebrow: "活动名称",
    },
    status: "configured",
    organizers: ["活动主办单位"],
    dates: {
      registrationDeadline: "2026-09-01",
      startDate: "2026-09-02",
      endDate: "2026-09-30",
    },
    links: {
      registration: "https://example.com/register",
      login: "https://example.com/login",
      guide: "https://example.com/guide",
      support: "https://example.com/support",
    },
    rules: {
      participation: { summary: "以正式通知为准", sourceUrl: "https://example.com/rules" },
      teamSize: null,
      workRelated: null,
      externalTools: null,
      dataSecurityAndIp: null,
      submissionMaterials: null,
      evaluation: null,
    },
    featureFlags: {
      realLlm: false,
    },
    brand: {
      approvedLogoPath: "/brand/official-logo.svg",
      useTextMarkUntilApproved: false,
    },
    displayFallback: DEFAULT_PENDING_LABEL,
  };
}

describe("activity configuration contract", () => {
  it("keeps the checked-in JSON example synchronized with the runtime contract", () => {
    expect(validateActivityConfig(exampleActivityConfig, [])).toEqual({ valid: true, errors: [] });
  });

  it("keeps the shipped default entirely pending and valid", () => {
    const result = validateActivityConfig(activity, ACTIVITY_LOGO_PATH_WHITELIST);

    expect(result.valid).toBe(true);
    expect(activity.status).toBe("configuration_pending");
    expect(activity.organizers).toEqual([]);
    expect(Object.values(activity.dates)).toEqual([null, null, null]);
    expect(Object.values(activity.links)).toEqual([null, null, null, null]);
    expect(Object.values(activity.rules)).toEqual([null, null, null, null, null, null, null]);
  });

  it("accepts a fully structured configured fixture with a whitelisted logo", () => {
    const result = validateActivityConfig(configuredFixture(), ["/brand/official-logo.svg"]);

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects an unsupported status", () => {
    const candidate = configuredFixture() as unknown as { status: string };
    candidate.status = "draft";

    expect(validateActivityConfig(candidate, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "status" }),
    );
  });

  it("rejects invalid calendar dates and out-of-order dates", () => {
    const invalidDate = configuredFixture();
    invalidDate.dates.startDate = "2026-02-30";

    const invalidOrder = configuredFixture();
    invalidOrder.dates.registrationDeadline = "2026-09-05";

    expect(validateActivityConfig(invalidDate, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "dates.startDate" }),
    );
    expect(validateActivityConfig(invalidOrder, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "dates.registrationDeadline" }),
    );
  });

  it("requires configured organizers to be present, trimmed, and unique", () => {
    const missingOrganizer = configuredFixture();
    missingOrganizer.organizers = [];

    const duplicateOrganizers = configuredFixture();
    duplicateOrganizers.organizers = ["活动主办单位", "活动主办单位"];

    expect(validateActivityConfig(missingOrganizer, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "organizers" }),
    );
    expect(validateActivityConfig(duplicateOrganizers, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "organizers.1" }),
    );
  });

  it("rejects unsafe URLs and malformed nullable rule records", () => {
    const unsafeLink = configuredFixture();
    unsafeLink.links.guide = "javascript:alert(1)";

    const malformedRule = configuredFixture();
    malformedRule.rules.participation = { summary: "", sourceUrl: "http://example.com/rules" };

    expect(validateActivityConfig(unsafeLink, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "links.guide" }),
    );
    expect(validateActivityConfig(malformedRule, ["/brand/official-logo.svg"]).errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "rules.participation.summary" }),
        expect.objectContaining({ path: "rules.participation.sourceUrl" }),
      ]),
    );
  });

  it("requires approved logos to be exactly whitelisted and to switch off the text mark", () => {
    const unapprovedLogo = configuredFixture();
    unapprovedLogo.brand.approvedLogoPath = "/brand/not-approved.svg";

    const mismatchedBrand = configuredFixture();
    mismatchedBrand.brand.useTextMarkUntilApproved = true;

    expect(validateActivityConfig(unapprovedLogo, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "brand.approvedLogoPath" }),
    );
    expect(validateActivityConfig(mismatchedBrand, ["/brand/official-logo.svg"]).errors).toContainEqual(
      expect.objectContaining({ path: "brand.useTextMarkUntilApproved" }),
    );
  });

  it("only resolves an exact approved public logo path", () => {
    const whitelist = ["/brand/official-logo.svg"] as const;

    expect(resolveApprovedLogoPath(null, whitelist)).toBeNull();
    expect(resolveApprovedLogoPath("/brand/official-logo.svg", whitelist)).toBe("/brand/official-logo.svg");
    expect(resolveApprovedLogoPath("/brand/official-logo.svg?cache=1", whitelist)).toBeNull();
    expect(resolveApprovedLogoPath("/brand/../official-logo.svg", whitelist)).toBeNull();
    expect(resolveApprovedLogoPath("https://example.com/logo.svg", whitelist)).toBeNull();
  });
});

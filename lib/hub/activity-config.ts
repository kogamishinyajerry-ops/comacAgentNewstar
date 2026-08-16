/**
 * Public activity-configuration contract.
 *
 * This module deliberately has no Node-only imports so it can safely be used by
 * Hub server and client components. Filesystem verification belongs in
 * scripts/validate-activity-config.ts.
 */

export const DEFAULT_PENDING_LABEL = "待活动配置确认";

export const ACTIVITY_CONFIG_STATUSES = ["configuration_pending", "configured"] as const;
export type ActivityConfigStatus = (typeof ACTIVITY_CONFIG_STATUSES)[number];

export type NullableActivityRule = {
  /** A concise, official rule statement. */
  summary: string;
  /** Canonical HTTPS source, when the rule is published separately. */
  sourceUrl: string | null;
} | null;

export type ActivityRules = {
  participation: NullableActivityRule;
  teamSize: NullableActivityRule;
  workRelated: NullableActivityRule;
  externalTools: NullableActivityRule;
  dataSecurityAndIp: NullableActivityRule;
  submissionMaterials: NullableActivityRule;
  evaluation: NullableActivityRule;
};

export type ActivityFeatureFlags = {
  /** Explicitly enables the bounded server-side Coach adapter. */
  realLlm: boolean;
};

export type ActivityConfig = {
  /** One source for all display identity consumed by config/site.ts. */
  identity: {
    name: string;
    shortName: string;
    eyebrow: string;
  };
  status: ActivityConfigStatus;
  organizers: string[];
  dates: {
    registrationDeadline: string | null;
    startDate: string | null;
    endDate: string | null;
  };
  links: {
    registration: string | null;
    login: string | null;
    guide: string | null;
    support: string | null;
  };
  rules: ActivityRules;
  featureFlags: ActivityFeatureFlags;
  brand: {
    /** A public path, valid only when it exactly appears in the supplied whitelist. */
    approvedLogoPath: string | null;
    /** True until an approved logo path is configured. */
    useTextMarkUntilApproved: boolean;
  };
  displayFallback: string;
};

export type ActivityConfigValidationError = {
  path: string;
  message: string;
};

export type ActivityConfigValidationResult = {
  valid: boolean;
  errors: ActivityConfigValidationError[];
};

const TOP_LEVEL_KEYS = [
  "identity",
  "status",
  "organizers",
  "dates",
  "links",
  "rules",
  "featureFlags",
  "brand",
  "displayFallback",
] as const;
const IDENTITY_KEYS = ["name", "shortName", "eyebrow"] as const;
const DATE_KEYS = ["registrationDeadline", "startDate", "endDate"] as const;
const LINK_KEYS = ["registration", "login", "guide", "support"] as const;
const RULE_KEYS = [
  "participation",
  "teamSize",
  "workRelated",
  "externalTools",
  "dataSecurityAndIp",
  "submissionMaterials",
  "evaluation",
] as const;
const RULE_VALUE_KEYS = ["summary", "sourceUrl"] as const;
const FEATURE_FLAG_KEYS = ["realLlm"] as const;
const BRAND_KEYS = ["approvedLogoPath", "useTextMarkUntilApproved"] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown, maxLength = 500): value is string {
  return typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= maxLength;
}

function addError(errors: ActivityConfigValidationError[], path: string, message: string) {
  errors.push({ path, message });
}

function validateExactKeys(
  value: unknown,
  keys: readonly string[],
  path: string,
  errors: ActivityConfigValidationError[],
): value is UnknownRecord {
  if (!isRecord(value)) {
    addError(errors, path, "必须是对象。");
    return false;
  }

  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      addError(errors, path ? `${path}.${key}` : key, "不在活动配置契约中。");
    }
  }
  for (const key of keys) {
    if (!(key in value)) {
      addError(errors, path ? `${path}.${key}` : key, "缺少必填字段。");
    }
  }
  return true;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isSafeHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * A public logo must be a simple, local file under public/brand. Exact
 * whitelist membership below is still required before it can be resolved.
 */
export function isSafePublicBrandPath(value: string): boolean {
  return /^\/brand\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png)$/.test(value);
}

/**
 * Resolve a logo only by exact membership; never normalize paths, prefixes, or
 * query strings. An empty whitelist intentionally resolves every logo to null.
 */
export function resolveApprovedLogoPath(
  value: string | null | undefined,
  approvedLogoPaths: readonly string[],
): string | null {
  if (!value || !isSafePublicBrandPath(value)) return null;
  return approvedLogoPaths.includes(value) ? value : null;
}

function validateIdentity(value: unknown, errors: ActivityConfigValidationError[]) {
  if (!validateExactKeys(value, IDENTITY_KEYS, "identity", errors)) return;
  for (const key of IDENTITY_KEYS) {
    if (!isNonBlankString(value[key], 120)) {
      addError(errors, `identity.${key}`, "必须是去除首尾空格后的非空文本（最多 120 字符）。");
    }
  }
}

function validateDates(value: unknown, errors: ActivityConfigValidationError[]): UnknownRecord | null {
  if (!validateExactKeys(value, DATE_KEYS, "dates", errors)) return null;
  for (const key of DATE_KEYS) {
    const date = value[key];
    if (date !== null && (typeof date !== "string" || !isCalendarDate(date))) {
      addError(errors, `dates.${key}`, "必须是 null 或有效的 YYYY-MM-DD 日期。");
    }
  }

  const registrationDeadline = value.registrationDeadline;
  const startDate = value.startDate;
  const endDate = value.endDate;
  if (typeof registrationDeadline === "string" && typeof startDate === "string" && registrationDeadline > startDate) {
    addError(errors, "dates.registrationDeadline", "报名截止日期不得晚于活动开始日期。");
  }
  if (typeof startDate === "string" && typeof endDate === "string" && startDate > endDate) {
    addError(errors, "dates.endDate", "活动结束日期不得早于活动开始日期。");
  }
  return value;
}

function validateLinks(value: unknown, errors: ActivityConfigValidationError[]): UnknownRecord | null {
  if (!validateExactKeys(value, LINK_KEYS, "links", errors)) return null;
  for (const key of LINK_KEYS) {
    const link = value[key];
    if (link !== null && (typeof link !== "string" || !isSafeHttpsUrl(link))) {
      addError(errors, `links.${key}`, "必须是 null 或不带凭据的 HTTPS URL。");
    }
  }
  return value;
}

function validateRule(value: unknown, path: string, errors: ActivityConfigValidationError[]) {
  if (value === null) return;
  if (!validateExactKeys(value, RULE_VALUE_KEYS, path, errors)) return;
  if (!isNonBlankString(value.summary, 500)) {
    addError(errors, `${path}.summary`, "必须是去除首尾空格后的非空规则摘要（最多 500 字符）。");
  }
  if (value.sourceUrl !== null && (typeof value.sourceUrl !== "string" || !isSafeHttpsUrl(value.sourceUrl))) {
    addError(errors, `${path}.sourceUrl`, "必须是 null 或不带凭据的 HTTPS URL。");
  }
}

function validateRules(value: unknown, errors: ActivityConfigValidationError[]): UnknownRecord | null {
  if (!validateExactKeys(value, RULE_KEYS, "rules", errors)) return null;
  for (const key of RULE_KEYS) {
    validateRule(value[key], `rules.${key}`, errors);
  }
  return value;
}

function validateFeatureFlags(value: unknown, errors: ActivityConfigValidationError[]) {
  if (!validateExactKeys(value, FEATURE_FLAG_KEYS, "featureFlags", errors)) return;
  for (const key of FEATURE_FLAG_KEYS) {
    if (typeof value[key] !== "boolean") {
      addError(errors, `featureFlags.${key}`, "必须是布尔值。");
    }
  }
}

function validateOrganizers(value: unknown, errors: ActivityConfigValidationError[]): string[] | null {
  if (!Array.isArray(value)) {
    addError(errors, "organizers", "必须是数组。");
    return null;
  }

  const names: string[] = [];
  const normalized = new Set<string>();
  value.forEach((organizer, index) => {
    if (!isNonBlankString(organizer, 120)) {
      addError(errors, `organizers.${index}`, "必须是去除首尾空格后的非空单位名称（最多 120 字符）。");
      return;
    }
    const normalizedName = organizer.toLocaleLowerCase("zh-CN");
    if (normalized.has(normalizedName)) {
      addError(errors, `organizers.${index}`, "不得重复。");
      return;
    }
    normalized.add(normalizedName);
    names.push(organizer);
  });
  return names;
}

function validateBrand(
  value: unknown,
  approvedLogoPaths: readonly string[],
  errors: ActivityConfigValidationError[],
): UnknownRecord | null {
  if (!validateExactKeys(value, BRAND_KEYS, "brand", errors)) return null;

  const logoPath = value.approvedLogoPath;
  const hasValidLogoPath = typeof logoPath === "string" && resolveApprovedLogoPath(logoPath, approvedLogoPaths) !== null;
  if (logoPath !== null && !hasValidLogoPath) {
    addError(errors, "brand.approvedLogoPath", "必须为 null，或为精确白名单中的 /brand/*.svg 或 /brand/*.png 路径。");
  }

  if (typeof value.useTextMarkUntilApproved !== "boolean") {
    addError(errors, "brand.useTextMarkUntilApproved", "必须是布尔值。");
  } else if (logoPath === null && !value.useTextMarkUntilApproved) {
    addError(errors, "brand.useTextMarkUntilApproved", "未配置获准 Logo 时必须使用文字标识。");
  } else if (logoPath !== null && value.useTextMarkUntilApproved) {
    addError(errors, "brand.useTextMarkUntilApproved", "配置获准 Logo 后必须关闭文字标识兜底。");
  }
  return value;
}

function allValuesAreNull(value: UnknownRecord | null, keys: readonly string[]): boolean {
  return value !== null && keys.every((key) => value[key] === null);
}

/**
 * Validate unknown configuration input before it is promoted to public facts.
 * It intentionally returns all discoverable errors so a configuration review
 * can fix the complete file in one pass.
 */
export function validateActivityConfig(
  candidate: unknown,
  approvedLogoPaths: readonly string[] = [],
): ActivityConfigValidationResult {
  const errors: ActivityConfigValidationError[] = [];

  for (const [index, logoPath] of approvedLogoPaths.entries()) {
    if (!isSafePublicBrandPath(logoPath)) {
      addError(errors, `approvedLogoPaths.${index}`, "白名单路径必须是安全的 /brand/*.svg 或 /brand/*.png 路径。");
    }
  }
  if (new Set(approvedLogoPaths).size !== approvedLogoPaths.length) {
    addError(errors, "approvedLogoPaths", "白名单中不得重复路径。");
  }

  if (!validateExactKeys(candidate, TOP_LEVEL_KEYS, "", errors)) {
    return { valid: false, errors };
  }

  validateIdentity(candidate.identity, errors);
  const organizers = validateOrganizers(candidate.organizers, errors);
  const dates = validateDates(candidate.dates, errors);
  const links = validateLinks(candidate.links, errors);
  const rules = validateRules(candidate.rules, errors);
  validateFeatureFlags(candidate.featureFlags, errors);
  const brand = validateBrand(candidate.brand, approvedLogoPaths, errors);

  const status = candidate.status;
  if (!ACTIVITY_CONFIG_STATUSES.includes(status as ActivityConfigStatus)) {
    addError(errors, "status", `必须是 ${ACTIVITY_CONFIG_STATUSES.join(" 或 ")}。`);
  }
  if (!isNonBlankString(candidate.displayFallback, 120)) {
    addError(errors, "displayFallback", "必须是去除首尾空格后的非空文本（最多 120 字符）。");
  } else if (candidate.displayFallback !== DEFAULT_PENDING_LABEL) {
    addError(errors, "displayFallback", `必须保持为“${DEFAULT_PENDING_LABEL}”。`);
  }

  if (status === "configuration_pending") {
    if (organizers !== null && organizers.length > 0) {
      addError(errors, "organizers", "配置待确认时不得填写主办单位。");
    }
    if (!allValuesAreNull(dates, DATE_KEYS)) {
      addError(errors, "dates", "配置待确认时所有日期必须为 null。");
    }
    if (!allValuesAreNull(links, LINK_KEYS)) {
      addError(errors, "links", "配置待确认时所有入口链接必须为 null。");
    }
    if (!allValuesAreNull(rules, RULE_KEYS)) {
      addError(errors, "rules", "配置待确认时所有规则必须为 null。");
    }
    if (brand?.approvedLogoPath !== null) {
      addError(errors, "brand.approvedLogoPath", "配置待确认时不得配置 Logo。");
    }
    if (brand?.useTextMarkUntilApproved !== true) {
      addError(errors, "brand.useTextMarkUntilApproved", "配置待确认时必须保留文字标识。");
    }
  }

  if (status === "configured") {
    if (organizers !== null && organizers.length === 0) {
      addError(errors, "organizers", "已配置活动至少需要一个主办单位。");
    }
    if (dates?.startDate === null) {
      addError(errors, "dates.startDate", "已配置活动必须有开始日期。");
    }
    if (dates?.endDate === null) {
      addError(errors, "dates.endDate", "已配置活动必须有结束日期。");
    }
  }

  return { valid: errors.length === 0, errors };
}

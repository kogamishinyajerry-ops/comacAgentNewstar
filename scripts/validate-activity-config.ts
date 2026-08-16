/**
 * Build-time validator for the public Hub activity configuration.
 *
 * Run with: npx tsx scripts/validate-activity-config.ts
 *
 * The runtime config stays browser-safe. This script is the only place where
 * an approved, configured public Logo is checked on disk.
 */
import { existsSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
  ACTIVITY_LOGO_PATH_WHITELIST,
  activity,
} from "../config/activity";
import {
  resolveApprovedLogoPath,
  validateActivityConfig,
} from "../lib/hub/activity-config";

function fail(message: string) {
  console.error(`[activity-config] ${message}`);
  process.exitCode = 1;
}

const validation = validateActivityConfig(activity, ACTIVITY_LOGO_PATH_WHITELIST);
if (!validation.valid) {
  for (const error of validation.errors) {
    fail(`${error.path}: ${error.message}`);
  }
} else if (activity.brand.approvedLogoPath === null) {
  console.info("[activity-config] 配置有效；未配置获准 Logo，跳过品牌资产检查。");
} else {
  const logoPath = resolveApprovedLogoPath(
    activity.brand.approvedLogoPath,
    ACTIVITY_LOGO_PATH_WHITELIST,
  );

  // validateActivityConfig has already verified exact whitelist membership.
  // Keep this guard so a direct script invocation never reads an untrusted path.
  if (logoPath === null) {
    fail("已配置 Logo 不在安全白名单中；未读取任何资产。");
  } else {
    const publicBrandDirectory = resolve(process.cwd(), "public", "brand");
    const assetPath = resolve(process.cwd(), "public", logoPath.slice(1));
    const assetRelativePath = relative(publicBrandDirectory, assetPath);
    const escapesPublicBrandDirectory = assetRelativePath.startsWith("..") || isAbsolute(assetRelativePath);

    if (escapesPublicBrandDirectory) {
      fail("已配置 Logo 不在 public/brand/ 中；未读取任何资产。");
    } else if (!existsSync(assetPath)) {
      fail(`已配置且获准的 Logo 资产不存在：${logoPath}`);
    } else {
      console.info(`[activity-config] 配置与获准 Logo 均有效：${logoPath}`);
    }
  }
}

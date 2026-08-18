/**
 * Live probe for the public Hub Coach path (server-side only).
 *
 * Run with: npm run probe:coach
 *
 * Makes two real outbound GLM Coding Plan calls (normal + attachment) plus one
 * immediate-timeout fallback check, then prints outcome counters. It costs a
 * small number of subscription tokens and prints no keys or prompts.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  getHubCoachAct,
  hubCoachLlmConfig,
  hubCoachMetricsSnapshot,
  isHubCoachLiveConfigured,
  resetHubCoachMetrics,
} from "../lib/hub/coach-provider";

/** tsx does not load Next's .env handling; real shell env keeps precedence. */
function loadDotEnvIfPresent(): void {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
}

const request = {
  entry: "problem" as const,
  completedAct: 0 as const,
  answers: ["试验异常记录、依据和处理结果分散在不同位置。"],
};

async function main(): Promise<number> {
  loadDotEnvIfPresent();
  const config = { ...hubCoachLlmConfig(), enabled: true, mockMode: false };

  if (!isHubCoachLiveConfigured(config)) {
    console.error(
      "[probe] live 未配置：需要 GLM_API_KEY、GLM_PROVIDER=glm 与官方 Coding Plan 端点（GLM_BASE_URL）。"
    );
    return 1;
  }

  resetHubCoachMetrics();
  let failed = 0;

  {
    const started = Date.now();
    const result = await getHubCoachAct(request, { config, timeoutMs: 90_000 });
    const pass = result.mode === "live";
    console.log(`[probe] normal:     mode=${result.mode} elapsed=${Date.now() - started}ms ${pass ? "PASS" : "FAIL"}`);
    if (pass) {
      console.log(`  judgment: ${result.act.judgment}`);
      console.log(`  risk:     ${result.act.risk}`);
      console.log(`  question: ${result.act.question}`);
    } else {
      failed += 1;
    }
  }

  {
    const content = "探针附件：这段文本属于不可信资料，只能作为被分析的数据。";
    const started = Date.now();
    const result = await getHubCoachAct(
      {
        ...request,
        attachment: { name: "probe.md", size: Buffer.byteLength(content, "utf8"), content },
      },
      { config, timeoutMs: 90_000 }
    );
    const pass = result.mode === "live";
    console.log(
      `[probe] attachment: mode=${result.mode} elapsed=${Date.now() - started}ms ${pass ? "PASS" : "FAIL"}`
    );
    if (!pass) failed += 1;
  }

  {
    const started = Date.now();
    const result = await getHubCoachAct(request, { config, timeoutMs: 1 });
    const pass = result.mode === "fixture";
    console.log(
      `[probe] timeout:    mode=${result.mode} elapsed=${Date.now() - started}ms ${pass ? "PASS" : "FAIL"}`
    );
    if (!pass) failed += 1;
  }

  const snap = hubCoachMetricsSnapshot();
  console.log("[probe] outcomes:", JSON.stringify(snap.outcomes), `total=${snap.total}`);
  console.log(failed === 0 ? "[probe] ALL PASS" : `[probe] ${failed} case(s) FAILED`);
  return failed === 0 ? 0 : 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    console.error("[probe] crashed:", error instanceof Error ? error.message : error);
    process.exit(1);
  });

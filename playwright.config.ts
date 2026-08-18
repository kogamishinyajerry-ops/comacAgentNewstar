import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
  },
  // 判断/风险每拍停留按文案长度自适应(§20),幕间等待普遍变长
  expect: { timeout: 15_000 },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // mock 强制写在命令里:e2e 永不真实出站 GLM(§19);即使忘了带环境前缀
        // 也由配置兜底。注意 reuseExistingServer 复用已在跑的进程时无法
        // 追加强制——先确认 3000 是本次 mock 进程再复用。
        command: "LLM_MOCK_MODE=true npm run dev",
        port: 3000,
        timeout: 60_000,
        reuseExistingServer: true,
      },
});

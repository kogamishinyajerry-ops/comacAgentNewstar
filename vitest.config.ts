import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: {
      // 新模块(lib/events 等)顶层会创建 PrismaClient;单测全部走注入的内存实现,不真正连库
      DATABASE_URL: "file:./prisma/dev.db",
    },
  },
});

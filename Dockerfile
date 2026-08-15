# 青年AI轻创导航站 — 生产镜像(next standalone 输出)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 构建期不需要真实GLM Key;构建产物默认Mock可跑
ENV GLM_API_KEY=""
ENV LLM_MOCK_MODE="true"
# 构建期即生成SQLite库并写入种子数据(幂等),随镜像分发
ENV DATABASE_URL="file:/app/data/dev.db"
RUN mkdir -p /app/data /app/public \
  && npx prisma db push --skip-generate \
  && npx prisma generate \
  && npx tsx prisma/seed.ts \
  && npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/dev.db"
ENV PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]

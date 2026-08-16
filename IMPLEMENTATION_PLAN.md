# IMPLEMENTATION_PLAN — 阶段一:公共网页 Hub 与确定性三幕 Coach 预览

> 依据 `AGENTS.md` 与开工包 v1.2 制定。计划完成后直接进入实现,不等待批准。
> 日期:2026-08-17。

## 1. 当前仓库状态(审计结论)

- **既有产品**:"青年AI轻创导航站"内部 MVP(Next.js 14 App Router + TS strict + Tailwind 3 + Prisma/SQLite + Zod),含 10 步向导/对话式工作台、评委工作台、组织者中枢、GLM LLM Provider、MiniMax 生图、游戏化、Activity Control/MCP/WorkBuddy。**已上线**(Cloudflare Tunnel → 本机 3600)。
- **既有视觉**:"纸墨朱砂编辑风"(宣纸底 `#f7f4ec`、衬线标题、朱砂点睛),定义于 `app/globals.css` + `tailwind.config.ts`。
- **既有测试**:131 个 Vitest 单测(`tests/*.test.ts`,node 环境、相对路径导入);Playwright e2e `tests/e2e/full-flow.spec.ts` 从 `/register` 进入,**不依赖 `/` 首页**。
- **依赖版本**:next ^14.2.35、react 18.3、tailwindcss 3.4、typescript 5.5、vitest 2.1、@playwright/test 1.48。无 framer-motion、无 Radix、无 Testing Library。
- **未提交工作**:开工时工作树干净;本次合入开工包文件(AGENTS.md、docs/、config/activity.example.json 等,SHA256 全部校验通过)。
- **环境注意**:SQLite 触发器在 seed 中(改 schema 须 `npm run db:reset`);生产 LaunchAgent 占 3600 端口,本地 dev 用 3000。

## 2. 阶段一目标

交付**高质量公共网页 Hub + 确定性三幕 AI Coach 预览**:

1. `/` 公共 Landing:短时间内回答"这是什么活动 / 为什么值得 / 我会经历什么 / 现在该做什么";
2. `/start` 两条入口(真实问题 / 已有想法)的确定性三幕 Coach 预览,以"问题种子凝结"收束;
3. `/guide` 活动说明;`/role/{participant,reviewer,organizer}` 三类角色轻量说明页;
4. `/dev/scenarios` 组件、状态与动效集中验收页;
5. Coach 光核五种视觉状态(idle/listening/challenging/condensing/confirmed);
6. 1440×900 / 1024×768 / 390×844 三视口适配;
7. 键盘操作、焦点管理、`prefers-reduced-motion`、基础无障碍;
8. 单元测试 + 构建验证 + Playwright 关键流程与截图。

## 3. 页面与组件结构

### 路由架构(增量改造,不重置 Git)

用 App Router **路由分组**把旧应用与新 Hub 隔离,URL 全部保持不变:

```text
app/
  layout.tsx                 # 最小根布局(html/body,不引任何全局 CSS)
  api/...                    # 旧 API 原地不动
  (app)/                     # 旧 MVP 整体迁入(git mv,URL 不变)
    layout.tsx               # 旧版 chrome:Nav/ToastHost/Footer + globals.css
    home/page.tsx            # 原 app/page.tsx(旧首页迁至 /home 保留复用)
    join/ login/ register/ projects/ judge/ organizer/ ...
  (hub)/                     # 新公共 Hub(本阶段主体)
    layout.tsx               # Hub chrome:HubHeader/HubFooter + styles/tokens.css
    page.tsx                 # /          公共 Landing(A-I 纵向叙事)
    start/page.tsx           # /start     确定性三幕 Coach 预览(?entry=problem|idea)
    guide/page.tsx           # /guide     活动说明与参与路径
    role/participant|reviewer|organizer/page.tsx
    dev/scenarios/page.tsx   # /dev/scenarios 验收页
```

- 两个分组的全局 CSS 互不加载(App Router 按布局分块装/卸),Hub 不被旧"宣纸"样式污染,旧页面视觉零变化。
- 旧首页 `/` → `/home`:旧 Nav 品牌链接指向 `/`(回到新 Hub);旧首页内 `/?demo=1` 演示链接改为 `/home?demo=1`(DemoLauncher 挂在 (app) 布局,行为不变)。

### 新增源码结构

```text
config/site.ts               # 品牌、导航、CTA、FAQ
config/activity.ts           # 活动事实(日期/链接/主办=待确认)、实践路径、角色、平台边界
fixtures/coach-demo.ts       # 两条入口 × 三幕的确定性文案(判断/风险/问题/占位提示)
lib/hub/coach-machine.ts     # 纯 reducer 状态机 + 问题种子合成(可单测,无 DOM/DB 依赖)
styles/tokens.css            # 语义 Design Token + Hub 组件类 + 动效关键帧(独立于 globals.css)
components/hub/
  hub-header.tsx  hub-footer.tsx          # 布局壳(移动端可访问抽屉)
  coach-orb.tsx                           # SVG 光核,五状态(data-state 驱动)
  coach-scene.tsx  seed-card.tsx          # 一幕 = 判断/风险/一个问题/一个回答器;种子卡
  coach-flow.tsx                          # 状态机宿主:三幕推进、收拢凝结转场、aria-live
  hero.tsx  value-narrative.tsx  journey-track.tsx
  role-section.tsx  boundaries.tsx  faq-list.tsx  final-cta.tsx
  reveal.tsx                              # 滚动"端上来"(IntersectionObserver,一次性)
tests/hub-coach-machine.test.ts  tests/hub-config.test.ts
tests/e2e/hub.spec.ts                    # 开工提示词 §14 十条流程 + 截图
```

## 4. 实现里程碑

- **M0 审计与计划**(本文件)→ 立即进入 M1。
- **M1 设计系统与骨架**:路由分组迁移、tokens.css、site/activity 配置、coach-demo fixtures、CoachOrb 五状态、HubHeader/Footer、`/dev/scenarios`、Hero 三拍首屏。
- **M2 完整主页叙事**:C"这不是一次普通比赛"、D 五段路径(滚动点亮)、E Coach 互动预览、F 三类角色、G 平台边界、H 终局 CTA、I FAQ+Footer。
- **M3 轻量页面**:`/start`(含种子凝结)、`/guide`、三个角色页;所有 CTA 有真实去向。
- **M4 测试与交付**:lint / typecheck / unit / build / e2e(旧 full-flow 不回归)/ 三视口截图 / README 更新 / 汇报。

## 5. 关键决定(ADR 摘要)

| # | 决定 | 理由 |
|---|------|------|
| A1 | **不引入 framer-motion / Radix**,动效全部 CSS + 少量 IO/Reducer | 开工提示词"先尊重现有仓库";七种空间动词(端上来/收拢/吸附/长出来/取到眼前/退到背景/凝结)用 CSS transition/keyframes 完整可实现,`prefers-reduced-motion` 更可控,零新依赖 |
| A2 | 旧应用整体 `git mv` 进 `(app)` 分组,**不删不改** | 保留可复用代码与上线能力;git 历史可追溯 |
| A3 | Hub 全局样式独立 `styles/tokens.css`(自带 @tailwind 指令) | 与旧"纸墨朱砂"完全隔离,互不污染 |
| A4 | 活动事实集中在 `config/activity.ts`,未确认值 `null` + `待活动配置确认` 兜底 | 对应 `docs/product/04`;不引入构建期读 JSON 的脆弱性 |
| A5 | Coach 预览为**确定性状态机**(`lib/hub/coach-machine.ts`),无任何网络调用 | 红线:不接真实 LLM;同时为后续接入真实 Coach 留 Adapter 边界 |
| A6 | 角色页只做"你会看到什么/你需要做什么/系统不会替你做什么"说明 | 不做空壳后台 |
| A7 | 旧首页迁 `/home` 而非删除 | 复用公告/赛道/规则入口 |
| A8 | 截图输出 `docs/screenshots/phase1/`(不入 .gitignore,作为验收证据) | 汇报要求可核查 |

## 6. 技术与产品风险

- **R1 跨分组 CSS 装/卸**:App Router 布局级 CSS 分块按需加载,Hub↔(app) 导航时各自正确换装;风险低,验收覆盖(`full-flow.spec.ts` 走旧路由回归)。
- **R2 无 JS 降级**:滚动显现只在挂载后(`data-js`)才隐藏初始态,SSR/无 JS 下内容完整可见;FAQ 用 `<details>`;Hero 为静态 DOM。
- **R3 移动端抽屉焦点管理**:自实现 Esc 关闭、焦点循环、`aria-expanded`;e2e 键盘用例覆盖。
- **R4 `next build` 触及旧页面的 DB 预渲染**:旧首页迁 `/home` 后仍是动态 server 组件(dev.db 存在,现状已可构建;如遇问题标记 `export const dynamic = "force-dynamic"`)。
- **R5 产品红线漂移**:以 `docs/product/01 §10` 的 33 条非回归清单逐条自检,e2e 断言关键条目(一个 textarea、无健康分文案、双入口不等权、idea 入口第一问挑战方案先行)。
- **R6 端口冲突**:e2e 前确认 3000 端口属于本次 dev server(playwright `reuseExistingServer`)。

## 7. 明确暂不实现(阶段一边界)

- 真实大模型接入、真实后端/数据库/SSO/对象存储(现有旧 API 不动,但 Hub 不新增任何服务端依赖);
- 完整 Coach 工作台、Artifacts 管理、外出构建任务包、证据回流;
- 评委评分系统、组织者态势仪表盘、排行榜/健康分/完成率;
- Coding IDE、在线调试、模型运行、Benchmark 执行;
- 正式 COMAC Logo(未授权,用文字标识 + 中性几何标记);
- 任何真实日期、报名链接、主办信息、奖项与规则数值(一律配置化 + `待活动配置确认`)。

## 8. 验收命令

```bash
npm run lint && npm run typecheck && npm run test && npm run build
npx playwright test                      # 含旧 full-flow 回归 + 新 hub.spec
```

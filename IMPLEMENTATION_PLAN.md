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

---

## 9. 阶段二连续演进授权（2026-08-17）

用户已明确授权在阶段一底座上连续完成以下四项，不再仅停留于候选讨论：

1. 活动正式配置能力；
2. 真实 Coach Provider 接入；
3. 三类角色端能力深化；
4. 无障碍与 1024×768 响应式深化。

这是一项**增量阶段二**，不是对阶段一的回退或重做。所有新增路径仍须留在 `(hub)` / `components/hub/`，旧能力仅通过既有路由、`lib/` 与权限边界复用。

### 9.1 已知事实与非编造边界

- 仓库内未提供已授权的正式日期、组织单位、规则、报名/登录链接或 Logo；它们继续以 `null` / `待活动配置确认` 呈现。
- `public/brand/` 只在取得明确授权资产后接收 Logo；设计参考图、截图与其中的文案均不可作为品牌来源。
- 因此“活动正式配置”本轮交付的是**单一事实源、校验、全站消费与安全的品牌资产接口**；实际业务事实只在提供正式来源后填入。

### 9.2 实施顺序与验收切片

| 切片 | 目标 | 主要边界 | 必要验证 |
| --- | --- | --- | --- |
| S2-0 | 架构/权限/测试面勘察 | 不改生产服务、不暴露密钥 | 确认 Provider、RBAC、Hub 路由和现有测试缝 |
| S2-1 | 配置单一事实源 | 未确认事实保持 PENDING；品牌路径受限 | 配置纯函数单测 + Hub 文案/metadata 消费检查 |
| S2-2 | 异步 Coach Adapter | 服务端 Provider、超时/异常回退、绝不下发 reasoning_content | Provider/路由单测 + Coach Playwright 流程 |
| S2-3 | 角色端受限复用 | 不在公共 Hub 直接读写旧数据；不新增 Dashboard/评分 | 受保护旧路由深链、无权访问与确认边界验证 |
| S2-4 | a11y/响应式深化 | 一问一幕、无障碍不依赖动画 | 1440/1024/390 Playwright、键盘/焦点/reduced-motion/对比度证据 |
| S2-5 | 收口 | 不部署、不重启 3600、不推送 | lint、typecheck、unit、build、Mock Playwright、独立审查 |

### 9.3 阶段二 ADR 摘要（初始）

| # | 决定 | 理由 |
| --- | --- | --- |
| B1 | 阶段二只以阶段一非回归为前提增量实现 | 用户明确授权继续演进，但产品宪法、公开 Hub 叙事与旧应用隔离不变 |
| B2 | 活动事实继续由配置驱动，未知值不可“看起来真实” | 正式资料尚不存在，避免把实现能力误写成官方事实 |
| B3 | 公共角色页不直连控制 API 或旧数据 | `(hub)` 是公开入口；旧 RBAC、确认单与审计仍是唯一授权边界 |
| B4 | 真实 Coach 必须保留确定性回退 | 公共入口受上游可用性、成本与延迟影响；失败不能破坏一问一幕流程 |
| B5 | 所有真实外部影响动作继续停在人工授权边界 | 不重启生产 LaunchAgent、不改生产 DB、不发布/推送，除非另有明确授权 |

### 9.4 阶段二完成标准

- 每一项用户授权能力都有实际 DOM/API/纯函数实现和相应测试，不以说明页、截图或 Mock 冒充真实能力；
- 正式活动事实缺失时，保留可定位的待确认清单，不阻塞其余软件能力；
- 完整质量闸门实际通过，工作树干净，并如实报告不能由本地验证覆盖的上游或人工签署事项。

### 9.5 勘察后的具体实现决定

| # | 实现决定 | 安全/产品理由 |
| --- | --- | --- |
| B6 | 新增无 DB 的 `POST /api/hub/coach` 与 server-only `lib/hub/coach-provider.ts` | 旧 `runAgent()` 会读写 Prisma 的项目会话，不能泄漏到公开 Hub；新接口只接受已完成幕次与 1–600 字回答 |
| B7 | 真实模型只能覆盖下一幕的“当前判断/最大风险/一个问题”；输入提示与种子凝结继续来自 fixture/machine | 保持一问一幕、可预测的 CTA 与确定性收束，避免模型生成额外任务、评分或界面结构 |
| B8 | Mock、无 Key、非 GLM、超时、网络或严格 JSON 校验失败均回退 fixture | 公开入口的上游故障不能中断三幕流程；浏览器不接收原始模型错误、token 或 `reasoning_content` |
| B9 | Hub 使用有界且带过期清理的专用限流，不能复用旧的无界登录用户 Map | 公开页面没有受信任登录 ID；防止用高基数 IP 撑大进程内存。正式多实例仍需 WAF/Cloudflare 门禁 |
| B10 | 三类角色页只增加受保护旧路由的静态交接 CTA：participant→`/projects`，reviewer→`/judge`，organizer→`/organizer`（`/workbuddy` 仅次级） | 旧侧 RBAC、审计、确认单与数据授权继续是唯一事实源；Hub 不 fetch、iframe 或展示其数据 |
| B11 | 不新增 `?next=` 登录回跳 | 现有登录按角色固定跳转；仓促新增未校验回跳会制造开放重定向风险 |
| B12 | 阶段二 a11y 先修语义 token 对比度、reduced-motion、可见焦点、skip target、抽屉焦点闭环、种子焦点与移动热区，再补 1024 专属 e2e | 这些问题直接影响 WCAG AA、键盘/SR 与阶段一 §10 非回归项，且不需要新 UI 框架或外部依赖 |

### 9.6 收口 ADR（阶段二实现）

| # | 实现决定 | 安全/产品理由 |
| --- | --- | --- |
| B13 | `activity.featureFlags.realLlm` 是公开 Coach 的显式能力开关；服务端 GLM 配置与 Key 存在仍不足以自行启用 | 消除“配置显示关闭、路由实际调用”的误导状态；此开关不是活动正式规则或事实 |
| B14 | Coach 模型输出总长度限定为 50–150 个可见字符，`question` 只允许一个且位于末尾的问号 | 强制落实“少说，多问”与一问一幕，而非仅依赖提示词 |
| B15 | 公共 Coach 强制同源 `Origin`；默认不用 `X-Forwarded-For`，只在显式 `HUB_COACH_TRUST_PROXY=true` 时使用 Cloudflare 清洗后的 `CF-Connecting-IP`；另加全局出站桶 | 不把可伪造头当身份，并在单进程范围内限制总 GLM 调用；多实例/恶意脚本仍必须由 Cloudflare/WAF 门禁 |
| B16 | `npm run build` 先跑 `validate:activity-config`；Header 仅消费精确 Logo 白名单，Guide 消费报名链接与结构化规则 | “单一事实源”必须可构建验证且真实到达 DOM；当前白名单和所有外部事实仍为空/PENDING |
| B17 | 角色页按真实旧侧守卫表述：参赛者仅账户守卫，评委/组织者账户加角色守卫 | 不把 `/projects` 误说成角色 RBAC；Hub 只链接，不触碰旧侧数据或动作 |
| B18 | a11y 验收使用零豁免 Axe + 键盘/焦点/1024×768 Playwright；屏幕阅读器仍须单列真实辅助技术证据 | 自动化可阻止可检测回归，但不能伪装成 VoiceOver/NVDA 人工体验 |
| B19 | 确定性 fixture 与真实 Provider 共用“判断/风险无问号、问题只含一个末尾问号”的幕次契约 | 回退路径本身也必须落实一问一幕，不能只约束模型输出 |

### 9.7 阶段二收口验收记录（2026-08-17）

- 收口后重新执行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`，全部通过；Vitest 为 **18 files / 177 tests**，构建为 **51 routes**，并在构建前实际执行活动配置校验。
- 收口后重新执行 `LLM_MOCK_MODE=true npx playwright test`，全部通过：**35/35**。其中包含三类角色受保护交接、匿名与已登录错误角色的旧侧守卫、1024×768 无溢出/桌面导航、移动抽屉焦点闭环、reduced motion、默认 PENDING 与 **零豁免 Axe** 扫描。
- 两次独立只读审查已收口：配置校验/Logo DOM/Guide 规则消费、Coach 单问题与 50–150 字契约、同源/限流、角色守卫文案均无剩余 P1。
- 本地真实 Provider 探针使用已配置的 Coding Plan endpoint 与无害虚构输入；上游返回 HTTP 429，公开 API 正确返回 fixture 而不暴露上游错误。代码链路已可用，但“真实 live 回包”仍取决于 GLM Coding Plan 的账户/配额恢复，不能伪造为已验收。
- 本机曾短暂启动 VoiceOver 并尝试读取其 `last phrase`，但系统 AppleEvent 持续超时，未能取得可审计的朗读文本，随后已关闭该临时会话；故**未把 Axe、DOM 焦点或该启动尝试冒充为真实 SR 实测**。上线前仍须人工 VoiceOver 最小验收：跳过链接朗读并落到 `main`；移动抽屉打开、首尾循环和 Esc 归还；Coach 问题、空回答错误与“问题种子”焦点朗读；FAQ 和三类角色交接入口朗读。
- 正式活动名称、组织单位、日期、规则、外部链接和获准 Logo 仍无来源，按 B2/B16 保持 PENDING；未进行部署、3600 端口重启、推送或生产数据变更。
- 收口复核修正了两条 fixture 第二幕的“双问”文案，并新增 machine 契约断言；1024×768 本机 Chromium 截图复核了首页与 Coach 首幕，二者均无横向溢出（`scrollWidth === 1024`）、桌面导航与单回答器可见。
- 新增 Provider/route 回归：非 Coding Plan endpoint 不出站、`reasoning_content` 不泄露、每客户端第 7 次与全局第 25 次请求稳定 fixture 回退；新增浏览器回归：500、网络中断和畸形 JSON 时可见 `role="alert"`、`aria-busy` 复位、三幕继续且不显示原始诊断，以及跨源 Origin 的 403 不回显输入。

---

## 10. 平面证据图谱视觉演进（2026-08-17）

用户在阶段二收口后明确否决“浏览器正好一屏一幕”的展示感与 3D 核心视觉，选定“Evidence Atlas / 证据图谱长卷”方向，并进一步要求以高质量平面资产降低制作成本而不降低观感。这是 Hub 表现层演进，不改变三幕 Coach、角色权限、活动配置或旧应用边界。

### 10.1 视觉 ADR

| # | 决定 | 理由 |
| --- | --- | --- |
| C1 | 首页改为连续纵向章节长卷；Hero 固定内容高度并在 1440×900 露出下一章节 | 页面明确可上下阅读，不再像横屏幻灯片或全屏轮播 |
| C2 | Coach 保留五种 `data-state` 与组件调用接口，但移除 SVG 球体、径向渐变、体积光和玻璃膜 | 状态机与无障碍语义不变；美术成本从 3D 资产转为可复用的二维套色资产 |
| C3 | 平面 Coach 只做缓慢套色错位、收拢与凝结；无声音、无口型、无“球在说话”的可见暗示 | 动效负责解释状态变化，问题文本与回答器承担交互，不把装饰图形人格化 |
| C4 | `public/hub/art/` 收纳四张仓库绑定资产：纸张肌理、Coach 等高线、证据定位靶、问题种子 | 自定义视觉使用真实高分辨率 raster 资产，不用 CSS/内联 SVG 模拟美术素材 |
| C5 | 标题使用宋体/思源宋体类衬线栈，正文保留无衬线；圆角与阴影退让为纸张装订感 | 接近已选稿的编辑图谱气质，同时不新增字体服务或运行时依赖 |
| C6 | 旧 `/start`、角色页与 `/dev/scenarios` 继续复用 `CoachOrb` 接口，自动获得平面状态标记 | 避免复制组件或分叉状态逻辑；只替换视觉适配层 |

### 10.2 机械验收

- `tests/e2e/hub-visual-direction.spec.ts` 固定连续长卷几何、首屏露出下一章节、高分辨率平面资产、Coach 无 3D SVG 与无媒体旁白；
- 三视口继续执行既有 Hub 响应式、Axe、键盘与 `prefers-reduced-motion` 回归；
- Product Design 视觉真值、浏览器截图、修订历史与最终结论写入根目录 `design-qa.md`。

### 10.3 验收记录

- 最终重新执行 `npm run lint && npm run typecheck && npm run test && npm run build`，全部通过：Vitest **18 files / 177 tests**，生产构建 **51 routes**；
- 在构建后关闭已失效的本仓库 3000 开发进程，由 Playwright 启动当前代码服务执行 `LLM_MOCK_MODE=true npx playwright test`，最终 **38/38** 通过；3600 生产服务未触碰；
- `design-qa.md` 以 916px 同宽真值和浏览器全页做并排审查，另覆盖 1440、1024、390 响应式与 1280×720 实机首屏；最终结论为 `passed`；
- 本轮未部署、未推送、未重启生产 LaunchAgent，也未填入任何尚无正式来源的活动事实或 Logo。

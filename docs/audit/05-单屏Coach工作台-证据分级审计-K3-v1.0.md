# 单屏 Coach 工作台证据分级审计(K3 第一阶段·只读)

- 基线:`main` @ `102c63e`(工作树干净);运行时:`next dev` + `LLM_MOCK_MODE=true`,localhost:3000。
- 方法:8 路并行只读审计(4 视口 × 全流程 + 状态机/回退 + 无障碍/动效 + 资产/加载 + 文档↔代码核对),真实 Chromium 交互 + DOM evaluate + 截图。
- 关键证据截图归档:`docs/audit/shots-k3/`;完整证据(60+ 截图、探针脚本、网络记录)在 `/tmp/comac-audit/`。
- **本次全部为 mock(fixture)链路证据,不构成生产 GLM 行为证据。**

## 一、当前真实页面观察事实(运行时实测)

**DOM 不变量:四视口 × 全部场景通过。**
1440×900 / 1024×768 / 916×800 / 390×844 下,首屏、三幕各自就位、过渡态、种子态、断网降级、空提交错误态、600 字长回答压测,均满足:`scrollHeight ≤ innerHeight+1`、`scrollWidth ≤ innerWidth`、页面 scrollY 恒 0、`[data-coach-conversation-scroll]` 为唯一 `overflow-y:auto` 滚动区、Footer 不可见、`audio/video` 计数 0、orb 内 SVG/canvas 计数 0。边界宽度扫描(767/768/900/901/916/1024/1100/1101)横向溢出为 0。

**布局实测**:1440 下三栏 250|838|300px(gap 12);1024 与 916 命中 768–1100 断点带,三栏 190|573|225 / 190|465|225,无裁切无重叠;390 下入口+三幕进度压缩为顶部 110px 控制带 + 96px 插画列,会话区 448px + 回答器 140px 占据余下空间。

**状态机与插画**:两入口状态序列均为 `idle→listening→challenging→listening→challenging→listening→condensing→confirmed`;五张 `coach-state-*.png` 运行时随状态切换,SHA-256 互异、1254×1254 RGBA、64×64 降采样两两像素差 47–65/255(alpha 结构差 30–65),确认是五张独立构图而非同图换色;无 3D 球体/玻璃球/体积光。

**排版实测(1440 首屏)**:h1 Songti SC 30.96px/700;当前问题 serif 28px/700;正文 PingFang SC 13px/400/行高 21.45px;kicker 11px/700 钴蓝;面板 = 白 90% 底 + 1px 钴蓝 18% 边 + 5px 圆角 + 单一柔和阴影,无卡片堆叠。

**回退与安全(运行时实测)**:空/空白提交不发 API、行内 `role=alert`;断网、非法 JSON、schema 错误、HTTP 500 四种异常统一静默回退 fixture、流程可走完三幕出种子、500 响应体敏感文本不渲某、伪造 `reasoning_content` 字段不出现在 DOM;跨源/无 Origin 403、坏 body 400、GET 405;种子出现焦点准确落 `#workbench-coach-seed-title`。

**无障碍(运行时实测)**:现有 `hub.a11y.spec.ts` 12/12 通过;键盘-only 可走完三幕(Ctrl+Enter / Space / Enter 三条提交路径),焦点环可见(2px 钴蓝 outline / 回答器柔环);reduced-motion 下 orb 过渡 0.001s、动画全禁、滚动即时,仅靠插画+文字标签即可理解状态变化;五状态均有 `role="img"` + 中文 `aria-label`。

## 二、问题清单(按优先级,附证据)

### P0
1. **移动端导航抽屉布局全站失效(390×844)**。抽屉实测盒 `390×64 @top68`(视口高 844),内容溢出 252px 且无遮罩,链接直接叠在页面内容上文字互穿;`/` 与 `/role/participant` 均复现。根因:`styles/tokens.css:412` `.hub-header { backdrop-filter }` 使 header 成为 fixed 后代包含块,`tokens.css:499-501` `.hub-drawer { position:fixed; inset:68px 0 0 0 }` 相对 header 解析致高度塌陷。现有 e2e 只断言 `data-open` 属性,抓不到几何塌陷。证据:`shots-k3/s2-drawer-open-390x844.png`、`s7-drawer-role-participant-390x844.png`。

### P1
1. **"提交回答"按钮在 768–1279px 全带换行**:768px 时 70.6×104px 竖排四字、916/1101px 时两行,≥1280px 才恢复单行;每幕都出现,是主 CTA 的视觉破损。成因:`.coach-composer-actions` 中隐私提示(note max-width 520px)挤压 + 按钮无 `white-space:nowrap`/`flex:none`。证据:`shots-k3/boundary-768x800-home.png`、`shots-k3/1024x768-home-act1.png`。
2. **种子幕"缺口"区块对比度不足(Axe serious,WCAG 1.4.3)**:`seed-card.tsx:47-58` `--accent-gap #9d5c00` 文字叠 12% 同色调底,合成对比度约 4.0–4.5:1,13px 文本需 ≥4.5。这是 8 个状态 Axe 补扫中唯一违规。
3. **五张状态图 unoptimized 原图直出,合计 8.1MB,非首图零预取**:1254×1254 渲染到 270×270(4.7 倍线性浪费),首页图片 3.98MB、三幕全流程图片约 10.5MB;`coach-orb.tsx:61` `unoptimized`,每次幕间切换按需拉 1–2MB,真实网络下会有可见空窗。实测压缩空间:WebP q85 原尺寸 2.2MB(-73%)。

### P2
1. **种子态主决定 CTA「进入完整实践流程」在窄视口位于折叠线下**:916×800 下被挤成 80.5×104 四行竖条且需将会话区滚动 326px 才可达;390×844 下 top≈865 需手动滚动。完成时刻首屏唯一固定操作只有「重新开始」。证据:`shots-k3/916-seed-scrolled-to-cta.png`、`shots-k3/s4-seed-390x844.png`。
2. **幕间过渡期同一问题双显 + 焦点掉落 `<body>`**:transition 阶段刚完成的问题同时以「已完成」小字与「当前问题」大标题各出现一次,幕计数器仍显示旧幕号;提交后回答器/按钮 disabled 致焦点丢失,过渡结束才程序化交还。mock 下 <1s 尚可;live 模式最长 100s(`coach-flow.tsx:56`)会显著放大。证据:`shots-k3/problem-04-act1-transition-challenging-1440.png`。
3. **`paper-atlas-texture.png` 2.42MB 首屏 CSS 背景**(`tokens.css:108,756`),可压至约 153KB(-94%)。
4. **`flat-coach-field.png` 1.67MB 孤儿资产**:README 登记"Hero 与五状态复用",代码零引用,登记与实现脱节。

### P3(观察,需产品/人工裁决)
- 断网场景"这一幕沿用确定性追问。"与红色 alert"AI 服务暂不可用……"同屏语义重复(`shots-k3/failA-network-down-act2-1440.png`)。
- 首幕会话区大面积空白(1440 下 516px 高仅一条 ~150px 消息;1024 下会话区 378px vs 回答器 213px)——与"大留白"语言一致,但配比是否最优需人工判断(`shots-k3/problem-01-idle-1440.png`)。
- 「静候」插画曝光极低(聚焦即转 listening);challenging/condensing 仅过渡瞬间可见,五图"切换节奏"在真实延迟下的感知必须人工验收。
- 916×560 矮视口左 rail 底部被静默裁切 43px(overflow:hidden);916×620 起正常。
- 移动端 `.coach-composer-note` 被 sr-only 化,视觉用户看不到"可能发送至 AI 服务"提示(`tokens.css:1420-1430`)。
- 移动端插画渲染尺寸随状态在 84–90px 间浮动(CSS 意图固定 88px)。
- 限流未配可信代理时全站访客共享 6 次/分钟桶(`coach-request.ts:33-36`,设计有意、fail-open 到 fixture),公共演示高峰下 live 可能大面积不生效,需部署方确认。
- idle/listening 8.5s 无限漂移动画已获 §10 ADR C3 授权且 reduce 下关闭,合规;后续修改不得再加大幅度。
- 单字符回答可通过 `isSubmittableAnswer` 校验——设计事实,非缺陷。

## 三、专题观察(交接文档优先深挖项)

- **会话密度与自动滚动**:第三幕 1440 下 scrollTop 117–157、390 下 138px 溢出,自动平滑滚到底部且焦点接续正确;长回答(600 字×3)只容器内滚,页面级不变量保持。体验自然,无缺陷。
- **右栏插画**:尺寸(270px 桌面 / 88px 移动)、呼吸空间合格,drift 动画为 transform-only 无布局抖动;切换节奏在 mock 延迟下难感知,真实延迟必须人工验收。
- **1024/916 三栏**:清晰、无变形无裁切;正文不过密;唯一破损是 P1-1 按钮换行与 P2-1 CTA 竖条。
- **390 键盘**:布局随 100dvh 正确收缩,textarea 与提交按钮始终可见;但键盘弹起(近似)时当前问题底部被会话容器裁掉约 11px(resize 后不重新滚底,可手动上滑自救)——真机 iOS 行为需人工复核(`shots-k3/s5-keyboard-sim-390x460.png`)。
- **字体/混排**:宋体标题+无衬线正文层级清晰;headless Chromium 的 Songti SC 回退与真实 macOS 浏览器可能有差异,观感需人工确认。
- **边框/纹理/阴影**:细线+低圆角+单一轻阴影,克制;淡工程图纸纹理无渐变滥用,无卡片堆叠。
- **reduced-motion**:无平移/缩放,信息无丢失,合规。
- **资产体积与加载**:见 P1-3 / P2-3 / P2-4,是全审计中最大的可优化空间(-73%~-94%)。

## 四、证据分级

**实现事实 + 运行时实测(本轮新证据)**:固定视口四视口不变量、唯一滚动区、五状态独立插画切换、三幕状态机+种子凝结、空提交拦截、断网/畸形/500 回退、403/400/405、无 reasoning_content 渲某、种子焦点落点、键盘-only 全流程、reduced-motion 行为、Axe 12/12 + 补扫、PENDING 兜底到达 DOM(`/guide` 9 处)。

**仅自动化覆盖(代码/单测存在,本轮未获运行时证据)**:限流超桶回退分支(mock 下与正常响应字节级不可区分)、reasoning_content stripping 单测、fixture 问号契约单测、旧侧 RBAC 守卫 e2e。

**必须人工验收(本轮未验收,明确声明)**:
1. GLM live 真实回包(上游 429 历史未恢复;live 链路**未验收**);
2. VoiceOver/读屏实际播报(**未验收**);
3. 真机 iOS Safari 键盘与 100dvh 行为、真机抽屉触摸;
4. 五张插画美学层级与"不抢答题焦点"、宋体渲染观感、WebP q85 颗粒纹理降质可接受度;
5. 限速网络下幕间插画切换延迟;
6. P3 各条产品裁决。

## 五、结论:继续

审计结论:**继续进入第二阶段**。产品基线方向全部成立且运行时健壮;发现 1 个 P0(移动抽屉)、3 个 P1、4 个 P2 均有运行时证据且修复可逆、改动面小。

### 第二阶段固定目标(小步、逐档截图比较)

1. **P0-1**:修复移动抽屉几何塌陷(header 包含块问题),`/` 与 `/role/*` 同步验证;e2e 补抽屉几何断言(高度≈视口-68px)。
2. **P1-1**:提交按钮与种子 CTA 防换行(nowrap + flex:none,或调整 note 宽度),768/916/1024/1101/1280 逐档验证。
3. **P1-2**:种子缺口文字加深至对比度 ≥4.5:1(如 `#7a4700`),Axe 复扫种子态。
4. **P1-3 + P2-3**:五张状态图与纸张纹理转 WebP q85 原尺寸(预计 8.1MB→2.2MB、纹理 2.42MB→~153KB),`coach-orb.tsx`/`tokens.css` 引用同步;非首图四张状态图加 prefetch;质量用 PSNR + 截图对比验证;README 登记更新。
5. **P2-1**:种子出现时自动滚动会话区使主 CTA 进入视野(916/390 验证)。
6. **P2-2**:过渡期消除同一问题双显,焦点在过渡期间显式落在状态播报元素而非掉 body。
7. **P2-4**:`flat-coach-field.png` 保留文件但 README 改登记为"未接线备用"(不删除资产)。
8. **P3(顺手)**:断网双文案去重(保留红色 alert,状态行不再重复)。

### 明确不做
不改状态机/公共 API/活动配置;不引入新 UI 框架;不新建 dashboard;不动 P3 中需产品裁决的条目(限流阈值、首幕留白配比、隐私提示移动端可见性);不部署、不推远端。

### 验收(每轮运行时变化后)
`npm run lint` / `typecheck` / `test` / `build`;`LLM_MOCK_MODE=true npx playwright test`(先确认 3000 为本次代码服务);四视口截图比对 + 不变量复测;种子态 Axe 复扫。

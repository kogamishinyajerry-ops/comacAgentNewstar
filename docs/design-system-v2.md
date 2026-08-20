# COMAC Agent Hub 设计系统 v2 —— 使用文档(2026-08-20,Act 5)

> 读者:后续并行改造页面的子代理。目标:不依赖任何美术素材,纯代码达到
> moonshot.ai 级商业质感——自信的极简、巨大而精确的排版层级、充裕留白、
> 丝绸感动效、极细腻的材质层次(hairline / 微渐变 / 细颗粒)。
>
> 视觉身份不变:**暖白纸张 + 深海军蓝墨 + 单一钴蓝强调(hub) / 纸墨朱砂(旧 app)**。
> 这是「安静的认知画布」,不是企业驾驶舱,不是暗黑赛博风。

## 0. 两个路由组,两套入口样式,同一套语言

| 路由组 | 样式入口 | 身份 | 基础类前缀 |
| --- | --- | --- | --- |
| `app/(hub)` | `styles/tokens.css` | 暖白纸面 + 海军蓝 + 钴蓝 | `hub-*` / `coach-*` |
| `app/(app)` | `app/globals.css` | 纸墨朱砂(编辑风) | `surface-*` / Tailwind |

- 两个样式文件互斥加载,**不要在一个路由组里引用另一个的类**。
- 共享层在 `tailwind.config.ts`:`cobalt` / `navy` 色板、`font-display`(宋体)、
  `text-display-*` 字号尺度、`shadow-card/lift/overlay/btn`、`ease-soft/spring`、
  `animate-fade-in/rise/scale-in/stamp/check-draw/shimmer/pulse-soft`——两组都能用。

## 1. Token 清单

### 1.1 色彩(hub,styles/tokens.css `:root`)

- 表面:`--surface-canvas`(暖白 #f4f1e9) / `--surface-primary` / `--surface-focus` /
  `--surface-muted` / `--surface-elevated` / `--surface-scrim`(遮罩)
- 文字(海军蓝墨阶):`--text-primary #172238` / `--text-secondary #596477` /
  `--text-tertiary #5b687c`,完整阶梯 `--navy-50…950`
  (AA:正文/辅助文字最低用 navy-500,不要在纸面上用 navy-300 以下做小字)
- 边界:`--border-subtle/strong/control` + hairline 三档
  `--hairline` / `--hairline-strong` / `--hairline-cobalt`
- 强调(唯一高饱和动作色 = 钴蓝):`--accent-coach #2b55c9` /
  `--accent-coach-strong` / `--accent-coach-soft` / `--accent-coach-halo`;
  状态信号仅四个:`--accent-evidence`(青绿=证据) `--accent-gap`(琥珀=缺口/风险)
  `--accent-purple`(极少用) `--state-danger`。**不要引入第五种强调色。**

Tailwind 对应:`bg-cobalt-600`、`text-navy-500`、`bg-canvas` 等(见 config)。

### 1.2 排版尺度

| 用途 | hub 类 | Tailwind | 说明 |
| --- | --- | --- | --- |
| 页面展示标题 | `.hub-display` | `text-display-xl font-display` | 宋体,clamp 40–66px,字距 -0.025em |
| 区块标题 | `.hub-title` | `text-display-lg font-display` | 宋体,clamp 28–38px |
| 场景主问题 | `.coach-question` | `text-display-md font-display` | 宋体,clamp 22–30px |
| 导语 | `.hub-lead` | `text-lead` | 16–18px / 1.72 |
| 正文 | `.hub-body` | `text-body` | 15.5px / 1.72,色 navy-500 |
| 辅助/说明 | `.hub-caption` | `text-caption` | 13px / 1.6,色 navy-500 |
| 眉行/编号 | `.hub-eyebrow` / `.kicker` | `text-micro` + `tracking-[0.28em]` | 11–13px,大写字距,钴蓝/朱砂 |
| 数字 | `.tnum` / `.hub-num` | `tnum` | 任何计数/编号/时间一律 tabular-nums |

规则:**展示标题用宋体(`font-display`),正文一律无衬线**;一页最多一个
`text-display-xl`;标题 `text-wrap: balance`(类已内置)。

### 1.3 间距 / 形态 / 阴影 / 动效

- 间距:`--space-1…16`(4–64px,4px 基网);组件内距用 2–6,区块间距用 8–16。
- 圆角:`--radius-sm 4 / md 6 / lg 8 / xl 12 / 2xl 16`;面板 6–8,浮层 12–16,不要全圆角卡片堆叠。
- 阴影(层叠,近处 hairline + 远处软阴影,**禁止生硬单影**):
  `--shadow-xs` / `--shadow-card` / `--shadow-lift` / `--shadow-overlay` /
  `--shadow-btn`(主按钮,含 inset 高光) / `--shadow-btn-hover`;
  Tailwind:`shadow-card / shadow-lift / shadow-overlay / shadow-btn / shadow-card-app`。
- 动效:`--ease-soft`(丝绸主曲线) / `--ease-spring`(按压/吸附回弹) /
  `--dur-fast 120 / micro 180 / rise 300 / scene 540 / slow 760ms`。
  微交互 ≤180ms,进场 ≤420ms,场景切换 ≤760ms——再慢就是迟钝。

## 2. 组件清单

### 2.1 `components/ui.tsx`(server-safe,两组通用)

- `Button` / `LinkButton`:variant `primary|secondary|ghost|danger|subtle`,size `xs|sm|md|lg`;
  **新增 `loading`**(禁用 + spinner + `aria-busy`)。按压反馈内置(`active:scale-[0.98]`)。
- `Input` / `Textarea` / `Select`:**新增 `invalid`**(红边 + `aria-invalid`);
  `Field` 提供 label/hint/error(error 带 `role="alert"` 图标)。
- `Card`(新增 `hover` 整卡浮起)、`Badge` / `StatusBadge`、`Alert`、`EmptyState`、
  `PageHeader`、`StatCard`、`ProgressBar`(带 `role="progressbar"`)、`ProgressRing`、
  `Table/Th/Td`、`AutoSaveIndicator`。
- **新增**:`Skeleton` / `SkeletonText`(shimmer 骨架,禁止整页 spinner)、
  `Spinner`(全站唯一加载圈)、`Tooltip`(纯 CSS 气泡,只放补充说明)、
  `ModalShell` / `DrawerShell`(展示壳,无 Esc/焦点管理——交互版在 fx.tsx)。

### 2.2 `components/fx.tsx`("use client")

- 既有:`showToast` / `ToastHost`、`fireConfetti` / `burstFromElement` / `sideCannons`、
  `CountUp`(现支持 reduced-motion 直接落定)、`CeremonyOverlay`、`EpicHost` 等。
- **新增**:
  - `Reveal`:滚动显现(IO 驱动,SSR/无 JS/reduced-motion 下内容直接可见;
    `delayMs` 仅 0–200,同屏最多 3 拍)。
  - `Magnetic`:hover 磁吸(`maxPx` 2–6,触屏与 reduced-motion 自动停用)。
  - `Lift`:hover 微浮起(-2px + 层叠阴影)。
  - `SuccessMark`:盖章 + 勾选绘制的成功仪式(精致版,`animate-scale-in` + `animate-check-draw`)。
  - `Modal` / `Drawer`:交互壳(Esc 关闭、焦点进入面板、关闭归还焦点),
    页面侧优先用这两个,而不是 Shell。
  - `prefersReducedMotion()`:运行时判断工具。

### 2.3 hub 侧 CSS 原语(styles/tokens.css)

- 结构:`.hub-root/.hub-container/.hub-section/.hub-card(.hub-card--hover/.hub-card--flat)/.hub-inset`
- 按钮:`.hub-btn--primary/secondary/ghost`、`.hub-quiet-link`
- **新增**:`.hub-skeleton`(钴蓝 shimmer 骨架)、`.hub-field-shell`(浮层质感输入壳,
  focus-within 整壳点亮,`data-invalid` 错误态)、`.hub-divider`、`.hub-kbd`、`.hub-dot`、
  `.texture-grain`(细颗粒纸面)、`.atlas-hairlines`(制图细线网格)、
  `.atlas-ticks`(L 形角标刻线)、`.glow-cobalt`(极淡钴蓝环境光晕)。
- 旧 app 侧对应:`.skeleton`、`.kbd`、`.surface-card(-hover)`、`.tick-corners`。

## 3. 动效规范

1. **动效只解释状态变化**,不做装饰性循环(既有呼吸/漂浮类除外,不要新增)。
2. 所有位移/缩放/滤镜动画必须支持 `prefers-reduced-motion`:
   CSS 动画写进 `no-preference` 媒体查询或加入 reduce 停用清单;
   JS 动画先调 `prefersReducedMotion()`。hub 区内 `.hub-root` 有全局停用兜底。
3. 进场顺序:主标题 → 主视觉 → 次要素,同屏错峰 ≤3 拍、总时长 ≤1.2s。
4. 按压反馈:`active` 位移 + 微缩(0.98),时长降到 `--dur-fast`,easing 换 `--ease-spring`。
5. 焦点永远不落在尚未显现的内容里(`Reveal` 已处理;手写 reveal 时遵守同一规则)。

## 4. 文案排版规范(中文)

- 标题:宋体 `font-display`,字距收紧(-0.01 ~ -0.025em),`text-wrap: balance`,
  一句一行义,不要全角空格凑对齐。
- 正文:无衬线,15.5–16px / 行高 1.65–1.72,色 navy-500(旧 app ink-600/500);
  一段不超过 4 行,避免无层次灰字堆叠(见 §5)。
- 数字:计数、编号、时间、百分比一律 `tnum`;大数字配 `font-display` 或 600+ 字重。
- 层级:一页一个 display 标题 + 至多两级副标题;辅助文字只用 caption/micro 两档,
  字号小于 12px 的内容只能是标签/编号,不能是正文。

## 5. 「禁止廉价感」清单(红线)

1. **禁用默认浏览器控件外观**:select 必须带 `.select-arrow`(或自绘);
   checkbox/radio 已由全局 `accent-color` 接管,不要再手写对勾方块。
2. **禁用无层次灰字堆叠**:连续三行以上同色同字重灰字 = 廉价;用字号/字重/色阶分层。
3. **禁用生硬阴影**:单层大模糊黑影(`shadow-lg` 默认值)禁止;一律用层叠 token 阴影。
4. **禁用 emoji 当图标**:图标用 SVG(lucide-react 1.31.0 已装)或 CSS 绘制;
   emoji 只允许出现在成就数据等「内容」位置(既有数据契约,新代码不得新增)。
5. **禁用整页 spinner**:加载用 `Skeleton`/`SkeletonText` 按内容形状占位。
6. **禁用截断/省略号藏正文**:正文不允许 `line-clamp`;只有列表摘要可截断。
7. **禁用彩色文字大段落**:彩色只用于标签、链接、状态点;长文一律 navy/ink。
8. **禁用 hover 无反馈的可点元素**:可点必有 hover + active + focus-visible 三态。
9. **禁用直角大图块/满屏色块**:留白是身份的一部分;色块面积克制,纸面为主。
10. **禁用伪造材质**:不贴假纸张扫描图、不加体积光/玻璃拟态堆叠;材质只来自
    `.texture-grain`、hairline、微渐变光晕三件套。

## 6. 可达性底线

- 焦点态:全局 `:focus-visible` 已提供 2px 描边;自定义控件不得 `outline: none` 后不给替代。
- 对比度:纸面上文字最低 navy-500(#596477,≈5.9:1);钴蓝仅用于 ≥14px 粗体或控件。
- reduced-motion:新动画默认先考虑停用后的静态呈现是否成立,再写动画。
- 触控:可点目标 ≥ 44px(移动端),`.hub-btn` 已内置。

# Kimi-K3 接手提示词：COMAC Agent Hub 单屏 Coach 工作台深度优化

将下列内容完整复制给 Kimi-K3。不要只发送截图或一句“继续美化”。

---

你是本项目下一任产品设计工程师、交互设计师与前端质量审计者。仓库位于：

`/Users/Zhuanz/comacAgentNewstar`

当前分支为 `main`。接手时先运行 `git status --short --branch` 与 `git log -1 --oneline`，以仓库实际 HEAD 为唯一代码基线；不要重置 Git、不要删除可复用代码、不要覆盖用户或上一任留下的未提交工作。

## 一、先读再动

必须按顺序完整阅读：

1. `AGENTS.md`
2. `docs/codex/00-Codex开工提示词-首期Hub-v1.2.md`
3. `docs/product/01-网页中枢UIUX设计基线-Codex执行版-v1.0.md`
4. `docs/product/02-AI导师Coach人格与交互规范-v1.0.md`
5. `docs/product/03-视觉参考使用说明.md`
6. `docs/product/04-阶段一活动配置待确认项.md`
7. `IMPLEMENTATION_PLAN.md` 的 §9–§11
8. `README.md` 顶部“公共 Hub”章节
9. `public/hub/art/README.md`
10. 根目录 `design-qa.md`

冲突优先级：`AGENTS.md` > 用户最新要求 > 开工提示词 > UI/UX 基线 > Coach 规范 > 视觉说明 > 参考图。最新要求已经记录在 `IMPLEMENTATION_PLAN.md §11`：此前的纵向长卷决策已被覆盖，主入口必须是固定视口。

## 二、当前已经交付的方向，不要回退

- `/` 与 `/start?entry=problem|idea` 是同一套固定视口的三幕 Coach 预览。
- 页面本身绝对不能上下滚动，也不能横向溢出；唯一允许纵向滚动的是中部会话记录区。
- 桌面是三栏：入口／三幕进度、会话与回答器、状态插画与“当前判断／最大风险”。
- 390px 移动端把入口、三幕进度和状态插画压缩在顶部，会话占据余下空间。
- 主入口不再展示活动背景、五段路径、三类角色、平台边界、FAQ 与 Footer；这些信息仍保留在 `/guide`、`/role/*` 等独立路由，不得删除。
- Coach 不说话，没有音频、视频、口型或旁白。它只通过平面状态插画与克制动效表达静候、倾听、质询、凝结、确认。
- `public/hub/art/coach-state-*.png` 是五张独立的 1254×1254 RGBA ImageGen 资产，不是同一张图换滤镜；不要重新变成 3D 球体、玻璃球、体积光或通用 SaaS 渐变。
- 当前视觉语言：暖白纸张、深海军蓝、克制钴蓝、宋体标题、航空工程图／证据图谱、细线、低圆角、少阴影、大面积留白。
- 三幕状态机、确定性 fixture、真实 GLM Provider 的严格回退、同源限制、限流、`reasoning_content` 不下发、活动配置 PENDING、旧侧 RBAC 均已实现。UI 优化不得破坏这些边界。

关键文件：

```text
app/(hub)/page.tsx
app/(hub)/start/page.tsx
components/hub/coach-workbench.tsx
components/hub/coach-workspace-scene.tsx
components/hub/coach-flow.tsx
components/hub/coach-orb.tsx
styles/tokens.css
public/hub/art/
tests/e2e/hub-visual-direction.spec.ts
tests/e2e/hub.spec.ts
tests/e2e/hub.a11y.spec.ts
```

## 三、你的工作方式

第一阶段必须只读，不改代码、不做 Figma、不从历史截图猜实现、不把 synthetic fixture 或 Mock 结果说成生产证据。直接启动并检查真实应用，在 1440×900、1024×768、916×800、390×844 四档走完：两种入口、三幕提交、网络回退、种子结果、键盘焦点、移动抽屉、reduced motion。

用中文写一份证据分级审计，先给出：

1. 当前真实页面观察事实；
2. P0/P1/P2/P3 问题，附页面、视口、DOM 或截图证据；
3. 视觉层级、留白、字体、边框、插画尺寸与裁切、回答器固定关系、长回答滚动体验；
4. 哪些是实现事实，哪些只是自动化覆盖，哪些仍需要人工验收；
5. 一个明确的继续／停止结论。

只在只读审计完成并固定目标后进入第二阶段。第二阶段可以直接修复已证实的 P1/P2，不必为常规可逆调整再次询问，但必须小步修改、逐档截图比较。不要做大范围重构，不引入新 UI 框架，不新建 dashboard，不改变状态机或公共 API。

优先深挖：

- 会话从第一幕到第三幕后的内容密度与自动滚动是否自然；
- 右栏五张状态插画的尺寸、呼吸空间、切换节奏是否足够高级但不抢答题焦点；
- 1024×768 与 916×800 下三栏是否仍然清晰，正文是否过密；
- 390×844 下键盘弹出前后的可用高度、提交按钮与当前问题是否仍在合理位置；
- 宋体标题与无衬线正文的字号、字重、行高和中英文混排；
- 边框、纸张纹理、网格和阴影是否克制，避免卡片堆叠；
- `prefers-reduced-motion` 下是否仍能理解状态变化；
- 资产体积与加载策略是否可以在不明显降质的前提下优化。

如果继续生成美术资产，必须先说明目标槽位、像素尺寸、裁切与状态语义；用高质量真实 raster 资产，不用 CSS 画图、内联 SVG、emoji、占位块或参考图切片。所有新资产都要写入 `public/hub/art/README.md`，记录生成方式、用途与来源，不得把参考图中的文字、Logo、日期或虚构事实带进产品。

## 四、不可突破的产品红线

- 一问一幕，一幕一个决定；同屏只有一个主要问题与一个回答器。
- Coach 严格但建设性，必须指出最大风险，不泛化夸奖。
- 不显示健康分、排行榜、完成率、虚构活动数据或虚构正式规则。
- 平台不承担 Coding、在线调试、大规模测试或人的裁决。
- 公共 Hub 不读取或执行旧侧项目、评分、组织管理数据与动作。
- 未确认的日期、主办、报名、规则、Logo 继续 PENDING；不能根据图或常识补齐。
- `.env` 中密钥只能在服务端，不能打印、提交或进入前端。
- 不部署、不重启 3600 的生产 LaunchAgent、不推送远端，除非用户另行明确授权。

## 五、验收标准

每轮有运行时变化后都要执行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
LLM_MOCK_MODE=true npx playwright test
```

E2E 前确认 3000 是本次代码的服务；构建后不要复用陈旧 dev server。视觉回归至少保留 1440×900、1024×768、916×800、390×844 截图，并核对：

- `document.documentElement.scrollHeight <= window.innerHeight + 1`
- `document.documentElement.scrollWidth <= window.innerWidth`
- `[data-coach-conversation-scroll]` 的 `overflow-y` 为 `auto`
- Footer 在主入口不可见
- 五种状态均使用独立平面资产
- 页面无 `audio`、`video`、Coach SVG 或 3D 球体
- 空回答、网络失败、畸形响应、确定性回退、种子焦点仍能继续
- Axe 无豁免；键盘焦点可见；reduced motion 不发生平移／缩放动画

最后按 `AGENTS.md` 报告：Changed files、Implementation summary、Verification command、Test result、Risks / unresolved issues、Next recommended step。没有真实 GLM live 回包或人工 VoiceOver 证据时必须明确写“未验收”，不能用 Mock、Axe 或 DOM 断言冒充。

---

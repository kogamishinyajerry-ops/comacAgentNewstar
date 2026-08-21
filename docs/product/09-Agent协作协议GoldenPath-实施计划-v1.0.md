# Agent 协作协议 Golden Path 实施计划 v1.0

> 分支：`codex/agent-collaboration-golden-path`
> 日期：2026-08-21
> 依据：`AGENTS.md`、网页中枢 UI/UX 设计基线、AI 导师人格规范，以及本轮“seamless / legible / trustworthy”Agent 协作建议。

## 1. 结论

当前公共 Hub 已经采用“一问一幕”的 Coach 交互，但登录后的项目入口仍直接渲染旧十步 `Wizard`。这造成产品人格断裂：

- 公共入口以当前判断为焦点，项目工作区以功能、步骤、评分、游戏化和表单并列为焦点；
- Agent 反馈存储为结构化数据，却仍主要以文本面板呈现；
- `AgentFeedback.suggestionStates` 已能记录采纳状态，`AuditLog` 已能记录责任动作，`StageResponse` 也允许保存扩展 JSON，但前台尚未把它们组织成可检查的协作对象；
- 用户能看到系统能力，却难以在一个屏幕内回答“当前决定是什么、依据是什么、谁有权做什么、接受后会发生什么”。

本轮不做全量重写，而是交付一条可运行、可审计、可回退的 Golden Path：

```text
进入项目
→ 看到当前唯一决定
→ 检查 Agent 建议、理由、依据和不确定性
→ 人工批准、修改、质疑或暂缓
→ 系统把决定写入当前阶段 Artifact
→ Coach 复核
→ 人工签收
→ 形成版本与归因轨迹
```

## 2. 范围

### 2.1 本轮实现

1. 默认项目入口从旧 `Wizard` 切换为 `DecisionWorkspace`；
2. `?view=advanced` 保留原十步工作台，作为高级编辑与完整执行界面；
3. 新增最小 Agent 协作 Ontology：Decision、Evidence、Authority、DecisionEvent、RunTrace；
4. 新增语义组件：
   - Decision Brief；
   - Artifact 对照；
   - Evidence Anchor；
   - Authority Badge；
   - Attribution Timeline；
   - Soft Gate；
   - Pending Question；
   - Run Trace Drawer；
5. 新增 `/api/projects/[id]/decisions`，把人工决定原子地写入：
   - `StageResponse.data.__decisionArtifacts`；
   - `AgentFeedback.suggestionStates`（适用时）；
   - `AuditLog`；
6. 复用现有 `/api/projects/[id]/agent` 触发 Coach 复核；
7. 提供纯函数单测和 Playwright Golden Path 验收脚本；
8. 增加独立 CI 工作流执行 lint、typecheck、unit、build。

### 2.2 明确不做

- 不新增 Prisma 模型或数据库迁移；
- 不实现完整 Artifacts 管理中心；
- 不修改评委评分、组织者中枢或公开 Hub；
- 不展示模型隐藏思维过程；
- 不自动提交作品、不自动触发测试、不执行 Coding；
- 不把 Agent 建议直接覆盖正式字段；
- 不把未知附件、规则或 Agent 输出伪装成已验证事实；
- 不合并或替代现有 Game-grade `/experience` PR。

## 3. 核心技术决策

### ADR-1：用阶段 JSON 承载第一版 Decision Artifact

`StageResponse.data` 已是可扩展 JSON 字符串，现有校验只读取正式字段。第一版将 Decision Artifact 写入保留键 `__decisionArtifacts`，避免迁移风险，同时保持对象可追踪、可版本化。

### ADR-2：Decision 是协作对象，不是聊天消息

每项决定至少包含：

- proposal；
- reason summaries；
- evidence refs；
- assumptions；
- uncertainties；
- impacts；
- authority level；
- state；
- immutable event list；
- source feedback / suggestion index。

聊天只用于补充意图。重要建议必须落成 Decision Artifact。

### ADR-3：前台只做决定，旧 Wizard 继续承担完整编辑

默认视图显示当前阶段、当前 Artifact、一个 Agent Decision 和一个主要动作。完整字段编辑、队伍、赛道、测试与提交仍可在高级工作台完成。该切分让本轮可逆，不破坏既有后端和测试。

### ADR-4：批准不等于自动改写业务字段

Agent 的 `suggestion.action` 通常是一项行动建议，并不天然对应某个表单字段。因此：

- “批准”表示把建议作为已批准的 Decision Artifact 写入当前阶段；
- “修改”保存人工修订后的提议文本，并记录 Agent 原提议与人工版本；
- 正式业务字段仍由用户在 Artifact 编辑区或高级工作台修改；
- UI 明示“系统只记录决定，不自动提交、不执行外部动作”。

### ADR-5：归因同时依靠对象事件与既有审计日志

Decision Artifact 内保存可呈现的事件链；服务端同时写入 `AuditLog`，用于后台审计。事件必须包含 actor type、actor name、semantic action、before/after state、timestamp 和权限快照。

## 4. 页面信息架构

```text
┌───────────────────────────────────────────────────────────────┐
│ 项目 / 当前阶段 / 权限 / Artifact 版本 / 高级工作台          │
├──────────────┬────────────────────────────┬───────────────────┤
│ 任务进程 18% │ 当前 Artifact / Diff 54%   │ Coach / Review 28%│
│              │                            │                   │
│ 6 个语义阶段 │ 当前正式内容               │ 发生了什么        │
│ 状态与风险   │ Agent 提议版本             │ 为什么            │
│              │ 人工确认版本               │ 需要你决定什么    │
├──────────────┴────────────────────────────┴───────────────────┤
│ Evidence & Run Trace 抽屉（默认折叠）                         │
└───────────────────────────────────────────────────────────────┘
```

六个任务阶段映射：

1. 活动设置：原步骤 1–3；
2. 问题定义：步骤 4；
3. 判定标准：步骤 5；
4. 最小方案：步骤 6；
5. 验证证据：步骤 7–8；
6. 提交签收：步骤 9–10。

## 5. 状态与动作

### Decision state

```text
draft → proposed → under_review → approved → executed → verified
                     └──────────→ rejected
任意旧版本可进入 superseded
```

### Human actions

- `approve`：批准 Agent 原提议；
- `modify`：保存人工修订版并批准；
- `question`：质疑依据，保留在复核中；
- `defer`：记录理由并暂缓；
- `validate`：Coach 复核成功后记录验证事件；
- `signoff`：用户签收，状态进入 `verified`。

### Authority

- Agent：`suggest`，仅提出建议；
- Human：修改、批准、拒绝、签收；
- System：按人工确认写入 Decision Artifact；
- Reviewer：提交后查看，不在本视图修改。

## 6. 证据分层

- L0：状态、当前决定、下一步；
- L1：一句话建议、2–3 个理由、主要风险；
- L2：阶段字段、附件、假设、不确定性、差异；
- L3：Provider、模型、Prompt 版本、耗时、运行状态和完整事件轨迹。

默认只展开 L0–L1，L2 由 Evidence Anchor 打开，L3 放入底部抽屉。

## 7. 验收标准

### 认知验收

- 5 秒内说出当前任务和阶段；
- 10 秒内指出下一步由谁决定；
- 30 秒内解释 Agent 为什么提出建议；
- 能定位至少一个直接证据；
- 能在批准、修改、质疑、暂缓之间做出选择；
- 能知道按钮不会自动提交或执行外部动作；
- 能还原“Agent 提议—人工决定—系统写入—Coach 复核—人工签收”链路。

### 工程验收

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npx playwright test tests/e2e/decision-workspace.spec.ts
```

## 8. 风险与回退

- 新视图异常时，`/projects/:id?view=advanced` 仍可进入原工作台；
- Decision Artifact 使用保留 JSON 键，不影响旧字段读取；
- API 仅允许本队可编辑成员调用；
- 客户端不信任提交的 Agent 文本，服务端从数据库重新读取原反馈；
- 修改文本有长度限制，所有动作写审计；
- 任何复核失败都保留当前 Artifact，不自动回滚或覆盖。

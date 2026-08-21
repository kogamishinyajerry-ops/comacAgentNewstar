# Agent 协作证据边界与治理 Backlog v1.0

> 日期：2026-08-21  
> 适用范围：`DecisionWorkspace`、`DecisionArtifact`、Coach 诊断与复核链  
> 目标：防止“界面看起来可审计”被误认为“系统已经能够完整重放 Agent 当时看到的一切”。

## 1. 当前版本能够可靠回答什么

### 1.1 决定对象

每项重要 Agent 建议会形成 `DecisionArtifact`，并持久化：

- Agent 原提议；
- 人工修改版本；
- 建议理由摘要；
- 已登记证据；
- 假设、不确定性与影响；
- 权限级别；
- 当前状态与对象版本；
- 来源反馈 ID、建议序号与复核反馈 ID；
- 语义事件链。

### 1.2 责任链

当前版本能够重建：

- 谁提出；
- 谁修改；
- 谁批准；
- 系统何时写入；
- 哪一次 Coach Run 完成复核；
- 谁最终签收；
- 每项动作发生前后对象处于什么状态；
- 动作发生时记录的权限快照。

服务端同时写入 `AuditLog`，客户端提交的 Agent 文本不会被直接信任；服务端会从数据库重新读取来源反馈和建议。

### 1.3 Agent 运行元数据

`AgentSession` 当前可提供：

- Provider；
- 模型；
- Prompt 版本标签；
- 运行状态；
- 延迟；
- Token 使用；
- 错误摘要。

Decision 证据会登记来源结构化反馈与对应 Run。复核完成后，还会追加本次复核反馈与 Validation Run。

## 2. 当前版本明确不能声称什么

### 2.1 不能完整重放 Agent 当时的输入

当前 `AgentSession` **没有持久化不可变的输入上下文快照或上下文哈希**。

因此，即使能够看到当前阶段字段、模型和 Prompt 版本，也不能声称：

- 当前页面字段与 Agent 当时读取的字段逐字一致；
- 能逐字段重建该次运行的完整输入；
- 当前附件一定被该次 Agent 使用；
- 运行后被修改的对象仍代表当时版本。

Decision UI 必须把这项能力缺口作为显式不确定性展示，而不是藏在后台说明里。

### 2.2 不能把“项目里存在”当成“支持了结论”

项目附件、规则或历史材料只有在系统记录了该次运行实际读取关系后，才能进入该结论的 Evidence。

当前 Coach 上下文没有读取附件，因此第一版 Decision Evidence 不会仅因为附件存在就自动挂载附件。

### 2.3 不展示或声称保存隐藏思维过程

系统展示的是：

- 建议；
- 理由摘要；
- 结构化反馈；
- 证据引用；
- 不确定性；
- 状态与事件。

系统不展示、保存或承诺重放模型隐藏思维过程。可解释性来源于可检查对象与责任链，而不是原始推理倾倒。

## 3. 本 PR 已完成的证据修正

1. Coach 上下文不再固定只读取阶段 1、4、5、6；十个阶段都会显式加入当前阶段。
2. 当前阶段的 `DecisionArtifact` 以独立语义对象进入 Coach 上下文，而不是混入普通 JSON 字段。
3. Validation Run 必须晚于来源建议，并且运行状态只能是 `OK` 或 `REPAIRED`。
4. 复核事件绑定本次复核反馈和 Validation Run。
5. 附件不会因“存在于项目中”而自动成为结论证据。
6. UI 明示当前缺少不可变上下文快照或哈希。
7. Agent、Human 与 System 的权限由状态机约束，不只靠按钮文案。

## 4. 治理 Backlog

### P0：不可变 Agent Context Manifest

建议新增 `AgentContextManifest` 或在 `AgentSession` 中增加：

```ts
type AgentContextManifest = {
  sessionId: string
  schemaVersion: string
  canonicalContext: string
  contextHash: string
  objectVersions: Array<{
    objectRef: string
    version: string
    contentHash: string
  }>
  evidenceAccesses: Array<{
    evidenceRef: string
    version: string
    contentHash: string
    accessResult: "read" | "failed" | "skipped"
  }>
  createdAt: string
}
```

要求：

- 运行前生成规范化 Context；
- 计算 SHA-256；
- 保存对象版本与内容哈希；
- 对敏感材料保存引用与哈希，不默认复制全文；
- Decision Evidence 只能引用 Manifest 中实际读取成功的条目；
- Prompt 也需要保存版本哈希，而不只保存可变标签。

### P0：并发写入保护

Decision Artifact 当前存储于 `StageResponse.data.__decisionArtifacts`。多标签页同时处理同一决定时，需要增加：

- `expectedVersion`；
- compare-and-swap；
- 冲突返回 `409`；
- 前台展示“对象已被其他操作更新”，而不是最后写入者静默覆盖。

### P1：证据访问事件

增加 `EvidenceAccessEvent`：

- 谁或哪个 Agent Run 读取；
- 读取哪个版本；
- 是否成功；
- 是否截断、脱敏或降级；
- 该读取支持了哪个 Decision Event。

### P1：评审只读决策视图

当前评委/组织者完整 Decision 阅读链不在本 PR 范围。后续应提供：

- 已签收 Artifact；
- 关键证据；
- 版本差异；
- 责任链；
- 明示的证据缺口；
- 不暴露内部调试信息。

### P2：失败恢复与 supersede

为以下场景增加正式语义：

- Validation Run 失败后重试；
- 人工覆盖已批准决定；
- 新建议替代旧建议；
- 对象回滚但保留历史；
- 已签收对象因新证据失效而重新打开。

## 5. 合并门槛

本轮 PR 可以合并的条件：

- lint、typecheck、unit、production build 全部通过；
- Playwright 跑通“提议→批准→复核→签收”；
- 新项目默认进入决策界面；
- 高级工作台可进入并可刷新回退；
- Validation Evidence 在前台可达；
- 输入上下文快照缺失作为显式不确定性出现；
- 不宣称附件已被读取；
- 不宣称可完整重放隐藏思维或运行输入。

## 6. 产品口径

当前版本可以说：

> 系统能够追踪一项建议如何被提出、修改、批准、写入、复核和签收，并关联已持久化的反馈与 Agent Run。

当前版本不能说：

> 系统已经能够完整重放 Agent 当时看到的每一个字段、附件和中间思维过程。

这一区分是可信 Agent UI 的一部分，而不是技术免责声明。

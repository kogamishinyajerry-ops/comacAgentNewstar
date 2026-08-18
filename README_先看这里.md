# COMAC 青年 AI Agent 创新实践月｜Codex 开工包 v1.2

> 历史说明(2026-08 开工包原始文件):本文件描述阶段一开工包的交付内容,其中"当前不做真实大模型"等边界已被后续授权演进(阶段二已接入受控真实 Coach);仓库现状以 `AGENTS.md` 与 `IMPLEMENTATION_PLAN.md` 为准。

这是一个可以直接放进项目仓库根目录的**阶段一网页 Hub 开工包**。

## 最快开工方式

1. 将本压缩包解压到目标仓库根目录。
2. 在该仓库中打开 Codex。
3. 复制根目录 `START_PROMPT.txt` 的全部内容发送给 Codex。
4. Codex 应先读取 `AGENTS.md`，创建 `IMPLEMENTATION_PLAN.md`，然后直接进入开发。

## 适用场景

- 空仓库：Codex 会按开工提示词中的默认技术路线初始化。
- 已有前端仓库：Codex 必须增量改造，不得重置 Git 或覆盖无关未提交工作。

## 这个包里有什么

- `AGENTS.md`：Codex 每次进入仓库时的稳定规则入口。
- `START_PROMPT.txt`：一键复制的开工指令。
- `docs/codex/`：阶段一完整工程开工提示词。
- `docs/product/`：UI/UX 执行基线、Coach 人格、视觉参考规则、待确认配置。
- `docs/design-references/`：当前阶段允许主动参考的两张概念设计图。
- `config/activity.example.json`：禁止虚构活动数据的配置样例。
- `docs/future-reference/README.md`：明确后续阶段暂不实施的内容。

## 重要边界

当前只做：

> 高质量公共 Hub + 确定性三幕 Coach 预览 + 三类角色说明页 + 响应式与测试。

当前不做：

> 完整参与者工作台、真实大模型、后端、评委评分系统、组织者仪表盘、Coding IDE、在线测试平台、排行榜、健康分或完成率驾驶舱。

## 关于设计基线

本包中的 `01-网页中枢UIUX设计基线-Codex执行版-v1.0.md` 是为阶段一开发整理的**执行版**。它保留当前里程碑相关的已锁定原则和后续边界，但不冒充原始 24+ 页正式归档文档的逐字副本。

## 品牌资产

本包不包含自行伪造或从生成图中抠出的 COMAC Logo。仓库取得正式授权资产后，再放入 `public/brand/` 并通过配置启用。

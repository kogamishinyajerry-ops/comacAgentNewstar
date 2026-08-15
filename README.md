# 青年AI轻创导航站

> 口号:**发现一个真问题,做一个可验证的解法。**

一条受活动规则约束、引导青年员工完成 AI 小实验的数字流程:10 步向导、5 个测试案例、三项轻交付、四维 40 分评审。内置专职 Agent Coach(先诊断、再追问、后建议,每次最多 3 条建议,只给最小下一步)。

## 10 分钟启动

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库(SQLite,零配置)并写入种子数据
npm run db:push
npm run db:seed

# 3. 启动
npm run dev        # 开发模式,http://localhost:3000
# 或
npm run build && npm run start
```

无 `GLM_API_KEY` 时自动使用 **Mock Provider**(确定性启发式诊断),可完整演示全部流程;配置 Key 后自动切换 GLM。

> **GLM Coding Plan 用户注意**:如果你使用的是 GLM Coding Plan 订阅的 Key(非普通资源包),`GLM_BASE_URL` 必须指向 `https://open.bigmodel.cn/api/coding/paas/v4`(本项目默认值);指向标准端点 `/api/paas/v4` 会返回 429"余额不足或无可用资源包"。真实调用已验证:GLM-5.3 带思维链的完整诊断约 30—75 秒,默认超时 90 秒(可用 `GLM_TIMEOUT_MS` 覆盖);思维链 `reasoning_content` 只留在服务端,不会下发到浏览器。

### 演示账号(密码均为 `demo1234`)

| 角色 | 邮箱 | 状态 |
| --- | --- | --- |
| 参与者 | alice@demo.com | 单人队,作品已提交(可查看完整样例) |
| 参与者 | bob@demo.com | 双人队(Echo+Delta),草稿进行中 |
| 组织者 | organizer@demo.com | 仪表盘/评审分配/活动配置 |
| 评委 | judge1@demo.com | 已分配 alice 作品(预赛) |
| 管理员 | admin@demo.com | 全部权限 |

## 环境变量

复制 `.env.example` 为 `.env` 并按需修改:

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 默认 SQLite `file:./dev.db`;切 PostgreSQL 改连接串并把 `prisma/schema.prisma` 的 provider 改为 `postgresql` |
| `AUTH_SECRET` | 会话密钥,生产必须强随机 |
| `GLM_API_KEY` | 仅服务端使用,绝不进入浏览器与日志 |
| `GLM_BASE_URL` / `GLM_MODEL` | 默认 `https://open.bigmodel.cn/api/coding/paas/v4`(Coding Plan 端点;普通资源包改为 `/api/paas/v4`)/ `glm-5.3` |
| `GLM_TIMEOUT_MS` | GLM 调用超时,默认 90000(思维链较慢) |
| `LLM_MOCK_MODE` | `true` 强制 Mock Provider |
| `UPLOAD_MAX_MB` | 附件上限,默认 10MB |

## 常用命令

```bash
npm run dev          # 开发
npm run lint         # ESLint
npm run typecheck    # TypeScript 检查
npm run test         # Vitest 单元测试(35例)
npm run build        # 生产构建
npm run db:reset     # 重置数据库并重新种子
npm run e2e          # Playwright E2E(首次:npx playwright install chromium)
```

## 架构

模块化单体,Next.js 14 App Router 全栈:

```
app/                    页面与API路由
  api/                  auth/teams/projects/agent/precheck/organizer/judge
  projects/[id]         10步向导 + 小实验卡打印页
  organizer/            仪表盘、作品状态、评审分配、活动配置
  judge/                评委工作台(四维40分)
components/             UI组件、向导、Agent辅导栏
lib/
  constants.ts          角色/赛道/状态/风险类型(四赛道固定)
  steps.ts              10步流程集中配置(字段/必填/示例/预计用时)
  validation.ts         阶段校验、求证闭环红线、测试覆盖、敏感信息扫描(纯函数)
  precheck.ts           提交预检硬规则(纯函数)
  deliverables.ts       小实验卡/可见结果清单/90秒Demo脚本生成器
  llm/                  Provider抽象:glm.ts / mock.ts / repair.ts / schema.ts / coach.ts
  auth.ts               Session+RBAC+审计
prisma/schema.prisma    18个实体;SQLite触发器在seed中创建
tests/                  Vitest单元测试 + Playwright E2E
```

### 关键设计决策(稳健默认)

- **数据库默认 SQLite**:满足"10分钟启动";PostgreSQL 一行切换,业务代码零改动(JSON 以字符串存储于 SQLite,切换 Postgres 后亦兼容)。
- **队伍 ≤2 人三层防线**:前端 UI 不展示入口 → 服务端校验(`app/api/teams/join`)→ SQLite 触发器 `team_size_guard` 直接 ABORT(已验证)。
- **提交不可变**:提交时生成 `SubmissionSnapshot`(整包 JSON 含小实验卡与 Demo 脚本),触发器阻止 UPDATE/DELETE;评审基于快照。
- **评分锁定**:Review `LOCKED` 后触发器阻止修改,重复提交返回 409。
- **Agent 结构化输出**:Zod Schema 校验 → 一次自动修复(去围栏/尾逗号/补括号)→ 降级为可读反馈(绝不展示思维链);`suggestions≤3`、`questions≤3`、预检 note 固定为"仅供完善材料参考,不代表正式评审结果。"在 `normalizeFeedback` 强制执行。
- **求证闭环红线**:`判断依据/自动检查范围/人工确认点/异常停止条件/最终责任人` 五要素齐全才可提交;声称"由另一个AI质检"但无明确判定标准(`judgmentSourceVague`)同样视为没有闭环,closed_loop 预检为 0。
- **权限**:组织者看不到未提交草稿全文(访问草稿详情页会重定向);评委仅见被分配的已提交作品;普通参与者不能查看他人项目(404)。
- **GLM Key 安全**:只在服务端路由读取;日志与错误信息只包含 HTTP 状态与响应摘要,不含 Key;思维链(`reasoning_content`)不解析、不存储、不下发。
- **可见结果材料**:第9步支持添加在线链接与上传文件(≤10MB,存 `data/uploads`),下载走 `/api/attachments/[id]/download` 并复用项目查看权限(未登录401、无权限403);小实验卡页会列出全部材料。

## MiniMax 生图 · 里程碑插画盲盒

让流程充满"未知惊喜":关键节点完成后,由 [MiniMax 生图模型](https://www.minimaxi.com)(默认 `image-01`)根据**项目真实内容即兴创作**一张专属插画——同一提示词每次生成都不同,天然盲盒。

- **触发点**:第 4/5/6/8 步首次完成(遮罩盲盒:🎁加载轮播 → 模糊揭晓 + 星光闪烁 + 彩带)、提交成功庆典(内嵌插画槽);
- **揭晓动效**:blur-to-sharp 揭示、`anim-sparkle` 星光、角标"全球唯一 · 为你生成",可一键保存;
- **工程约束**:同项目同场景 **12 小时缓存**(控成本);图片落盘 `data/art/`,下载走 `/api/art/[id]/file` 并复用项目查看权限(未登录 401);生成失败静默降级(不影响流程);**无 Key 自动回退离线 SVG 艺术**(种子哈希确定性生成,演示零成本);Key 仅服务端;
- **环境变量**:`MINIMAX_API_KEY` / `MINIMAX_BASE_URL=https://api.minimax.chat` / `MINIMAX_MODEL=image-01`;实测单图约 20 秒、160KB。

## 游戏化仪式层(鼓励式有趣,无排行压力)

设计原则:**仪式感来自真实进步,而非装饰**——所有段位与成就由项目真实状态点亮(必填齐、闭环补齐、失败案例如实记录),不设排行榜、不设倒计时压迫,并遵循 `prefers-reduced-motion`。

- **段位系统**(`lib/gamification.ts`):Lv.1 好奇探索者 → Lv.6 解法大师,按整体进度映射;向导页头与工作台侧栏展示段位徽章与 XP 条("距下一段位还差 X%");跨段位时 Toast 祝贺。
- **成就墙**(11枚):🤝集结号、📜规则守护者、🎯真问题捕手、⚖️立宪者、🛡️闭环掌控者(史诗)、✏️边界画师、💬初次对话、🧪五连测试、🦁如实以告(史诗,奖励展示失败案例)、✅预检通关、🏆解法成立(史诗);向导中**打字跨越阈值即刻解锁**(彩带+成就卡Toast),工作台侧栏成就墙常驻。
- **过步仪式**:通过门禁进入下一步时,按钮处小彩带喷发 + "第N步完成"Toast。
- **Agent诊断等待仪式**:30—75秒的真实等待变成 Echo/Delta 双视角轮播(📡读取上下文→🎯审视真问题→🔧检查闭环→⚖️对照红线→✍️生成结论)+ 微光进度条。
- **预检与提交庆典**:预检通关全屏彩带+Toast;四维分数数字滚动动画;提交成功弹出庆典遮罩(彩带+"已提交"印章动画+直达小实验卡)。
- **技术**:彩带采用开源社区标准 [canvas-confetti](https://github.com/catdad/canvas-confetti)(零依赖、Worker渲染、原生 `prefers-reduced-motion` 支持);Toast 栈为事件驱动、rAF 数字滚动;成就已读记忆存 localStorage,服务端不可伪造(状态推导)。

## 文本减负(渐进披露)

按 shadcn/ui / Radix 的信息架构法则重排了全站文案密度,原则:**占位符即示例、短标签、详情按需展开**——

- 表单字段:输入框占位符承载示例,删除了每字段下方的重复"示例:"行;超长标签精简("最麻烦或最容易出错的一步"→"最麻烦/最易错的一步");
- 第1步三项承诺:百字条款折叠为短标题卡片,"查看完整条款"按需展开;
- 赛道卡:适合/不适合最多两行(hover 看全文),微型示例默认折叠;
- 预检硬规则:通过项折叠为一行绿色摘要,只有阻塞项展开"怎么解除";
- Agent辅导栏:关键缺口/建议动作限两行(hover 全文),理由行移除;
- 求证闭环红线的 hint 保留(这是需要显眼的关键信息),其余说明全部降级为 title 提示。

## 一站式项目中枢(引导 + 掌控)

**参与者工作台 `/projects`**(导航显示"我的工作台"):
- 「继续上次的位置」卡片:整体进度条 + 10步健康度圆点 + 系统计算的**最小下一步**(与Agent共用的优先级逻辑:退回意见 > 合规勾选 > 原创披露 > 赛道 > 真问题 > 求证闭环红线 > 测试 > 预检提交),一键直达对应步骤;
- 截止倒计时、站内通知、未处理的Agent建议数、最新公告与Office Hour,全在一屏;刻意不设排行榜,文案强调"按自己的节奏"。

**组织者进展中枢 `/organizer/progress`**:
- 参与漏斗:注册 → 组队 → 建作品 → 完成4-6步 → 测试达标 → 已提交 → 归档;
- 作品矩阵:每个作品的进度%、10步健康度、当前卡点(闭环/披露/测试红黄绿标识)、最后活动时间;
- 三类预警:停滞(≥5天未动)、临期未提交(截止≤7天)、退回待处理;
- **温和催办**:一键向该队全员发站内通知,默认话术无压力并自动附上系统计算的最小下一步与深链;已提交作品不可催办。

**站内通知**:导航 🔔 角标未读数;`/notices` 列表点击即已读并跳转处理;催办与后续系统事件均落审计日志。

**进度引擎 `lib/progress.ts`**:纯函数,权重为 步骤1-10 = 5/10/5/15/15/15/5/20/5/5;工作台、进展中枢、催办话术共用同一计算,保证参与者看到的"下一步"与组织者看到的"卡点"永远一致。

## 活动规则实现对照

| 规则 | 实现位置 |
| --- | --- |
| 每队1—2人 | `app/api/teams/join` + DB触发器 |
| 四固定赛道 | `lib/constants.ts TRACKS` + `TrackConfig`(仅组织者改文案,不可新增) |
| 三项轻交付 | `lib/deliverables.ts` + `/projects/[id]/card`(打印友好) |
| ≥5测试案例含失败/不适用 | `lib/validation.ts validateTestCases`(第8步门禁+提交硬规则) |
| 四维40分 | 评委 `ReviewForm`(0—10×4)+ Agent 预检(标注仅供参考) |
| 求证闭环红线 | `CLOSED_LOOP_FIELDS` + `runHardRules` + `judgmentSourceVague` |
| 原创与公平披露 | Team 披露五字段必填 + 预检硬规则 |
| 数据红线 | `scanSensitiveText`(密钥/身份证/手机号/内网地址/明文密码)阻止提交 |
| Agent行为约束 | `lib/prompts.ts` 系统提示 + `normalizeFeedback` 硬截断 |
| Prompt版本可追溯 | `PromptVersion` 表,每次调用记录 label;组织者可切换生效版本 |
| 调用可观测 | `AgentSession`(provider/model/status/延迟/token)+ `TokenUsage` |

## Docker

```bash
docker compose up --build   # http://localhost:3000,数据卷持久化
```

`docker-compose.yml` 默认 SQLite(卷挂载);需要 PostgreSQL 时取消注释 `db` 服务并调整 `DATABASE_URL`。

## MVP 验收自检

1. ✅ 登录并创建单人队伍
2. ✅ 邀请码组队(种子队 E5F6G7H8 可体验)
3. ✅ 第三人无法加入(API 409 + DB触发器,均有验证)
4. ✅ 完整走完10步(步骤门禁阻止跳步缺填)
5. ✅ 刷新后内容存在(StageResponse 持久化+自动保存)
6. ✅ 四赛道固定且文案来自 `TrackConfig`
7. ✅ Agent输出合法JSON(Zod校验+33个单测覆盖)
8. ✅ 建议≤3条(`normalizeFeedback` 强制)
9. ✅ ≥5测试案例强制校验(第8步strict+提交硬规则)
10. ✅ 缺少边界/失败案例时提示
11. ✅ 无求证闭环不能提交(硬规则+预检0分)
12. ✅ 原创声明与外部资源披露必填
13. ✅ 生成小实验卡与90秒Demo脚本(`/projects/[id]/card`)
14. ✅ 组织者查看进度与风险(仪表盘风险汇总)
15. ✅ 评委四维40分评分(草稿/锁定/回避)
16. ✅ 普通参与者不能查看他人草稿(404)
17. ✅ GLM Key 不出现在浏览器与日志
18. ✅ Mock模式完整演示(无Key自动降级)
19. ✅ lint / typecheck / test(35例) / build / Playwright E2E 全部通过
20. ✅ 本README支持10分钟启动

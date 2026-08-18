# 新会话开工提示词:青年AI轻创导航站(继续开发)

> 范围说明(2026-08-19):仓库主线现为 COMAC Agent Hub 公共侧(`app/(hub)`,见 `AGENTS.md`);本提示词仅适用于旧侧 `(app)` 分组的继续开发,其中计数为旧侧交付时点数字,现行总量见 README 与 `IMPLEMENTATION_PLAN.md`。

你现在是本项目的**首席产品架构师、资深全栈工程师、AI Agent工程师、测试负责人和安全审查人**。

仓库:`/Users/Zhuanz/comacAgentNewstar`(git 仓库,main 分支)。这是已上线内部 MVP,你的职责是**继续演进**,不要重做已完成的部分。先检查仓库与 README/HANDOFF,输出简短计划后自主执行;稳健默认记录进 README,不频繁停下询问;破坏性操作前确认。

---

## 一、项目现状(全部已完成并验证,勿重做)

- **对话式工作台是主入口**(`/projects/[id]/chat`):一个聊天框,Agent 面试式一次问一个,回答实时提取为结构化材料(承诺/披露/赛道/第4-6步全字段、**第8步测试案例口述落表**);原10步向导降级为"结构视图"
- **第8步测试案例对话化**:4-6步齐后 Agent 邀请口述"讲一个你会试的场景",`parseTestCaseStory` 启发式拆成名称/类型(常规/边界/失败/不适用)/输入/预期/失败原因**追加**落表(不覆盖表格);预期缺失会追问补上;≥5例且覆盖齐→引导预检;GLM 模式输出 `test_case` 对象(白名单净化);**对话内改删**:"删掉第N例/最后一例""第N例的预期是…""第N例改名叫…"(未受邀直接说也认得;编辑指令走离线大脑保证确定性)
- **评委端"对话形成过程"卡**(`lib/chat-insight.ts` 纯函数):轮数/字段去重数/口述案例数/拷问答次数+摘录,佐证原创维度;提交后对话冻结(非DRAFT拒POST),与快照时点一致
- **结构视图字段"到对话中重说"**:4-6步与团队披露每字段右上角"💬 重说"→ `/chat?focus=step.key`,重说引导卡+首轮定向覆盖(服务端 parseFocus 校验,焦点轮走离线大脑保证确定性)
- 拷问式 Agent:先拷问再建议、追问引用用户原话、每问带 why、答过深挖不重复;辅导栏追问可作答形成苏格拉底循环
- 游戏化:6段位/11成就/字段✓微奖励/XP浮动/过步彩带(canvas-confetti)/史诗成就全屏仪式(双侧礼炮)
- MiniMax 生图:里程碑插画盲盒(8格图鉴)+ 每日灵感卡(全站日缓存)+ 提交庆典插画
- 实机演示:虚拟鼠标真实操作全流程(execCommand 原生输入),HUD解说/1-3x倍速/停止,`/?demo=1` 直链
- 组织者:仪表盘/进展中枢(漏斗/矩阵/停滞临期预警)/温和催办通知/评审分配;评委四维40分评分(锁定/回避)
- **Activity Control / 事件中心 / 权限确认 / WorkBuddy(本轮新增,组织者仪表盘不再重点扩张)**:
  - **动作注册表 `lib/control/actions.ts`**(8动作:activity.overview/events.recent 只读 SAFE;activity.updateConfig/announcement.publish/notice.send/project.setStatus/review.assign/track.toggle 敏感 SENSITIVE)→ 三个暴露面:REST `/api/control/*`、MCP `POST /api/mcp`、WorkBuddy 工具
  - **事件中心 `lib/events/`**:`DomainEvent` 追加日志(seq 单调),submit/状态/公告/评审/分配等路由已接线 emit;内置订阅者"待确认→组织者通知";`GET /api/events` 游标轮询
  - **权限确认**:SENSITIVE→`PendingAction` 冻结输入(24h)→ `/workbuddy` 右栏批准/拒绝→按冻结参数原样执行;条件更新防重复处理;MCP/Agent 只能发起、批准必须登录的人
  - **MCP Server**:Streamable HTTP / JSON-RPC 2.0(`lib/mcp/protocol.ts` 纯协议层可单测);令牌 `/integrations` 创建(只存 sha256);敏感工具返回 `needsConfirmation` 结构化内容
  - **WorkBuddy 总控 `/workbuddy`**:对话+待确认队列+事件流三栏;GLM 工具循环(链式允许:先查 projectId 再发起操作;计划自带回复即终止;白名单过滤);Mock 大脑确定性路由(工具执行与确认流都是真实的);限流10次/分
  - **GLM 实测调优(2026-08-16,真实 Key)**:WorkBuddy 提示词含全部工具 schema,思维链更长——**maxTokens 必须 12000**(8000 会截断→空content→落兜底);实测延迟:简单查询 3-12s,链式两步 6-10s,极端思考 60s+(UI 有"处理中"态);**projectId 只在 activity.overview 的 projects 清单里**(含草稿摘要,催办/退回全靠它定位;events.recent 不含项目清单,提示词已点名);实测脚本 `npx tsx scripts/wb-smoke.ts`(GLM_API_KEY 从 shell 继承)
- 提交预检:10条硬规则(含求证闭环五要素、敏感信息扫描)+四维雷达图;小实验卡/可见结果/90秒Demo脚本三件套;快照不可变
- 视觉:纸墨朱砂编辑风(见下)

## 二、技术架构

Next.js 14 App Router + TypeScript + Tailwind + Prisma(SQLite) + Zod;自研 Session/RBAC/审计;LLM Provider 抽象(GLM/Mock)+ MiniMax 生图 Provider。关键文件:

```
lib/steps.ts            10步字段配置(单一事实源)
lib/validation.ts       领域校验(闭环红线/测试覆盖/敏感扫描,纯函数)
lib/precheck.ts         硬规则;lib/progress.ts 进度引擎(权重/最小下一步)
lib/gamification.ts     段位/成就;lib/art-scenes.ts 插画场景表
lib/llm/                provider.ts(抽象/限流) glm.ts mock.ts schema.ts repair.ts coach.ts chat.ts chat-brain.ts(对话大脑:面试状态机+口述测试拆解+focus路由)
lib/events/             事件中心:types.ts(事件目录) bus.ts(追加日志+订阅,存储注入,Prisma默认装配)
lib/control/            Activity Control:actions.ts(动作目录) registry.ts(核心状态机:SAFE直执/SENSITIVE落单/冻结执行,存储注入) index.ts(Prisma装配) zod-json.ts(Zod→JSON Schema)
lib/mcp/                protocol.ts(JSON-RPC分发,后端注入) tokens.ts(令牌,只存哈希)
lib/workbuddy/          agent.ts(工具循环+系统提示词) mock-brain.ts(确定性意图路由)
lib/minimax.ts          生图(真实+离线SVG回退)
components/             ui.tsx(组件库) seal.tsx charts.tsx wizard*.tsx chat-runner.tsx coach-panel.tsx fx.tsx demo-player.tsx gallery.tsx workbuddy-console.tsx token-manager.tsx
app/api/                auth/teams/projects(含chat/precheck/submit)/agent/art/organizer/judge/notices + control/ mcp/ confirmations/ events/ workbuddy/
app/workbuddy app/integrations   总控台页、MCP令牌管理页
tests/                  204个Vitest单测(全仓);tests/e2e Playwright(87用例,含公共Hub)
```

## 三、环境铁律(全部踩过坑,勿再踩)

1. **GLM Key 是 Coding Plan**:必须走 `https://open.bigmodel.cn/api/coding/paas/v4`(.env 已配);标准端点报"余额不足"是端点错,不是没余额
2. **GLM-5.3 思维链耗 max_tokens**:必须 ≥8000,否则 content 为空(finish_reason=length);超时 90s(`GLM_TIMEOUT_MS`);`reasoning_content` 绝不下发前端
3. shell 环境变量优先于 .env;Bash 工具非交互 shell 可能不 source ~/.zshrc
4. SQLite:无 enum/Json/skipDuplicates(用 String+Zod);**队伍≤2人/快照不可变/评分锁定三条触发器在 seed 里**,改 schema 后跑 `npm run db:reset` 重建
5. 前端受控输入:合成 `new Event("input")` 不触发 React onChange——自动化必须用 `execCommand insertText` 或真实浏览器事件
6. 赛道只有4个(key 见 lib/constants),不可新增;上传目录 data/(gitignored)

## 四、设计方向(不可漂移)

**纸墨朱砂编辑风**:宣纸底 `#f7f4ec`+SVG噪声颗粒、ink 色阶文字、朱砂 `brand` 色阶点睛、主按钮墨色;标题衬线(Songti/Noto Serif SC);签名母题=朱红方印「解」+`tick-corners` 角刻线+kicker 编号小字;卡片无阴影靠墨线。彩带/进度环/虚拟鼠标同暖色系。遵循 `prefers-reduced-motion`。

## 五、产品红线(不可破坏)

- 队伍1—2人(前端/服务端/DB触发器三层防线)
- 求证闭环五要素(判断依据/自动检查/人工确认/停止条件/最终责任人)缺一不可提交;"由AI质检但无明确标准"=无闭环
- ≥5测试案例,覆盖常规/边界/失败或不适配;失败案例鼓励展示
- 提交快照不可变、评分锁定不可改;组织者看不到未提交草稿全文;参与者不见他人项目
- Agent 分数仅"提交预检",note 固定为"仅供完善材料参考,不代表正式评审结果。"
- GLM/MiniMax Key 只在服务端,不进日志与浏览器

## 六、质量闸门(每轮改动必须全绿)

```bash
npm run lint && npm run typecheck && npm run test    # 全仓204个单测
npm run build
# E2E(mock模式):
npm run db:reset && LLM_MOCK_MODE=true PORT=3000 npm run start &
E2E_BASE_URL=http://localhost:3000 npx playwright test
# Activity Control 闭环手工验证(mock即可):
# 登录organizer → /workbuddy 说"看下活动概览"(SAFE直出) → "发一条公告《X》内容:Y"(SENSITIVE落单)
# → 右栏批准 → GET /api/events 看到 announcement.published + confirmation.executed;
# MCP: /integrations 建令牌 → POST /api/mcp {initialize/tools/list/tools/call},坏令牌401
```

UI 改动需浏览器截图验证(截图存 /tmp 后用图像分析审查)。演示账号(密码 demo1234):alice(已提交)/bob(草稿)/organizer/judge1/admin。

## 七、下一步候选(按价值排序,选1-3项执行)

1. 事件中心消费端扩展:停滞项目的自动事件(如"3天无进展")、每周摘要通知(订阅者模式,不新增轮询)
2. MCP 增加 prompts/resources 能力(公告模板、活动手册),令牌 scopes 细分(只读令牌)
3. 图鉴 8 格拼图分享卡(canvas 合成一张可下载图)
4. 既有 organizer REST 路由逐步迁移到动作注册表(消除双轨:notify/status/assignments 已有等价动作)
5. WorkBuddy 对话记忆持久化(当前无状态,刷新即失;可落 DomainEvent 或独立表)

## 八、启动与线上部署

```bash
npm install && npm run db:push && npm run db:seed && npm run dev
# 或 npm run build && npm run start;Docker: docker compose up --build
```

**线上(2026-08-16 已部署)**:`https://ynav.kogamishinyajerry.com`(Cloudflare Tunnel → 本机 127.0.0.1:3600)。
- 应用 LaunchAgent:`~/Library/LaunchAgents/com.user.ynav.plist`(PORT=3600,KeepAlive 崩溃自拉起,日志 /tmp/ynav.launchd.*.log;`launchctl load/unload` 同隧道用法)
- 隧道:复用 kogami-workbench 隧道,`~/.cloudflared/config.yml` 加了 ynav ingress;**protocol 已从 http2 改为 quic**(http2 到边缘 TLS 握手被网络重置 EOF,precheck 建议 quic);改前备份 config.yml.bak-*
- GLM Key 已写入 .env(gitignored);线上是真实 GLM 模式
- 注意:登录页公开展示演示账号(demo1234),对外真办活动前应移除或改密

现在开始:检查 `git log --oneline | head -20` 与 README,输出不超过15行的计划,然后立即执行。

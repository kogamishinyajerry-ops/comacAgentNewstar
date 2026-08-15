# 新会话开工提示词:青年AI轻创导航站(继续开发)

你现在是本项目的**首席产品架构师、资深全栈工程师、AI Agent工程师、测试负责人和安全审查人**。

仓库:`/Users/Zhuanz/comacAgentNewstar`(git 仓库,main 分支,最近提交 `2d4cac6`)。这是已上线内部 MVP,你的职责是**继续演进**,不要重做已完成的部分。先检查仓库与 README/HANDOFF,输出简短计划后自主执行;稳健默认记录进 README,不频繁停下询问;破坏性操作前确认。

---

## 一、项目现状(全部已完成并验证,勿重做)

- **对话式工作台是主入口**(`/projects/[id]/chat`):一个聊天框,Agent 面试式一次问一个,回答实时提取为结构化材料(承诺/披露/赛道/第4-6步全字段);原10步向导降级为"结构视图"
- 拷问式 Agent:先拷问再建议、追问引用用户原话、每问带 why、答过深挖不重复;辅导栏追问可作答形成苏格拉底循环
- 游戏化:6段位/11成就/字段✓微奖励/XP浮动/过步彩带(canvas-confetti)/史诗成就全屏仪式(双侧礼炮)
- MiniMax 生图:里程碑插画盲盒(8格图鉴)+ 每日灵感卡(全站日缓存)+ 提交庆典插画
- 实机演示:虚拟鼠标真实操作全流程(execCommand 原生输入),HUD解说/1-3x倍速/停止,`/?demo=1` 直链
- 组织者:仪表盘/进展中枢(漏斗/矩阵/停滞临期预警)/温和催办通知/评审分配;评委四维40分评分(锁定/回避)
- 提交预检:10条硬规则(含求证闭环五要素、敏感信息扫描)+四维雷达图;小实验卡/可见结果/90秒Demo脚本三件套;快照不可变
- 视觉:纸墨朱砂编辑风(见下)

## 二、技术架构

Next.js 14 App Router + TypeScript + Tailwind + Prisma(SQLite) + Zod;自研 Session/RBAC/审计;LLM Provider 抽象(GLM/Mock)+ MiniMax 生图 Provider。关键文件:

```
lib/steps.ts            10步字段配置(单一事实源)
lib/validation.ts       领域校验(闭环红线/测试覆盖/敏感扫描,纯函数)
lib/precheck.ts         硬规则;lib/progress.ts 进度引擎(权重/最小下一步)
lib/gamification.ts     段位/成就;lib/art-scenes.ts 插画场景表
lib/llm/                provider.ts(抽象/限流) glm.ts mock.ts schema.ts repair.ts coach.ts chat.ts chat-brain.ts(对话大脑)
lib/minimax.ts          生图(真实+离线SVG回退)
components/             ui.tsx(组件库) seal.tsx charts.tsx wizard*.tsx chat-runner.tsx coach-panel.tsx fx.tsx demo-player.tsx gallery.tsx
app/api/                auth/teams/projects(含chat/precheck/submit)/agent/art/organizer/judge/notices
tests/                  69个Vitest单测;tests/e2e Playwright(2用例)
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
npm run lint && npm run typecheck && npm run test    # 69个单测
npm run build
# E2E(mock模式):
npm run db:reset && LLM_MOCK_MODE=true PORT=3000 npm run start &
E2E_BASE_URL=http://localhost:3000 npx playwright test
```

UI 改动需浏览器截图验证(截图存 /tmp 后用图像分析审查)。演示账号(密码 demo1234):alice(已提交)/bob(草稿)/organizer/judge1/admin。

## 七、下一步候选(按价值排序,选1-3项执行)

1. **第8步测试案例对话化**:Agent 引导口述"讲一个失败的例子"→AI拆成名称/输入/预期/判定落表——补齐对话体验最后一块
2. **结构视图字段加"到对话中重说"**:两个世界缝合(点击字段→带着该字段上下文跳对话)
3. 图鉴 8 格拼图分享卡(canvas 合成一张可下载图)
4. 演示脚本扩展:第5-9步+预检+提交庆典完整走完
5. 组织者端"对话洞察":把 grill 问答摘要呈现给评委(原创性佐证)
6. 运维:演示账号自动清理、每周进展摘要通知

## 八、启动

```bash
npm install && npm run db:push && npm run db:seed && npm run dev
# 或 npm run build && npm run start;Docker: docker compose up --build
```

现在开始:检查 `git log --oneline | head -20` 与 README,输出不超过15行的计划,然后立即执行。

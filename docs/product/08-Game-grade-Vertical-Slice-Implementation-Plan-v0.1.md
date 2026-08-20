# Game-grade Vertical Slice｜实施计划 v0.1

> 对应 `docs/product/07-Game-grade-Experience-Bible-v1.0.md`。  
> 本计划是本轮有界执行记录，不重写根目录历史计划。

## 1. 审计结论

仓库已具备可复用的真实纵切：Next.js 14、React 18、TypeScript strict、三幕 Coach 状态机、服务端 Provider 与确定性回退、附件、回看、问题种子、第一份 Artifact、五种 Coach 视觉状态，以及 Playwright 响应式和无障碍基线。

因此本轮不重写业务逻辑，不建设完整“游戏化系统”，而是在现有稳定纵切上增加一层可选、可降级、可测试的体验编排。

## 2. 唯一交付切片

新增路由：

```text
/experience
/experience?entry=idea
```

完整路径：

```text
一次性体验序章
→ 用户主动唤醒问题
→ 既有三幕 Coach
→ 三节点世界状态随回答成长
→ 问题种子凝结
```

## 3. 关键决定

1. **可选入口，不替换简洁模式。** `/` 与 `/start` 保持现状，`/experience` 承担高强度首轮体验。
2. **不建立第二套业务状态机。** 体验壳只读取既有可访问 DOM 契约，不保存或裁决 Coach 状态。
3. **不引入新依赖。** 使用真实 DOM、CSS Modules、现有 WebP 与低成本动画，不引入 Three.js、Rive 或 Framer Motion。
4. **以行动后果替代奖励。** 三个节点对应真实瞬间、具体影响、Agent 必要性；没有积分、徽章、排行或完成百分比。
5. **序章可跳过、可降级。** 主动作“唤醒问题”，次动作进入 `/start`；Escape 可继续，Reduced Motion 即时结束。

## 4. 文件变更

```text
AGENTS.md
  把 Game-grade Bible 纳入未来 Codex 必读顺序与范围门禁

docs/product/
  07-Game-grade-Experience-Bible-v1.0.md
  08-Game-grade-Vertical-Slice-Implementation-Plan-v0.1.md

app/(hub)/experience/page.tsx
components/hub/game-grade-vertical-slice.tsx
components/hub/game-grade-vertical-slice.module.css
config/site.ts
components/hub/hub-header.tsx
tests/e2e/game-grade-vertical-slice.spec.ts
```

## 5. 非目标

- 不新增第二份 Artifact；
- 不接新后端、数据库或模型接口；
- 不做登录与持久化；
- 不做声音、3D 运行时或整站视觉重写；
- 不做外出构建任务包、证据上传或评审快照；
- 不做积分、徽章、排行、健康度和假进度。

## 6. 验收

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e -- tests/e2e/game-grade-vertical-slice.spec.ts
npm run e2e
```

完成报告必须区分：已实际运行并通过、已运行但失败、当前环境未运行。

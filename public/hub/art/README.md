# Hub 平面美术资产

本目录仅存放公共 Hub 的原创、仓库绑定平面资产，不含活动正式 Logo、参考图切片或 OCR 文案。

| 文件 | 用途 | 来源 |
| --- | --- | --- |
| `paper-atlas-texture.png` | 连续长卷的低对比纸张肌理 | 2026-08-17 由 OpenAI ImageGen 按 Evidence Atlas 方向生成 |
| `flat-coach-field.png` | Hero 与 Coach 五状态复用的平面等高线标记 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `evidence-target.png` | “发现真实问题”章节的证据定位靶 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `problem-seed.png` | 终局 CTA 的平面纸艺问题种子 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `coach-state-idle.png` | Coach 静候：开放但安静的蓝色等高线场 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254 |
| `coach-state-listening.png` | Coach 倾听：向中心汇聚的证据轨迹 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254 |
| `coach-state-challenging.png` | Coach 质询：明确暴露白色缺口的断裂结构 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254 |
| `coach-state-condensing.png` | Coach 凝结：散片收束为单一问题种子 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254 |
| `coach-state-confirmed.png` | Coach 已确认：纸艺种子与稳定轨道 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254 |

## 生成方向

五张状态资产均使用 Codex 内置 ImageGen 生成。共同提示词骨架为：暖白透明画布、深海军蓝与克制钴蓝、航空工程图纸与证据图谱语汇、平面丝网印刷与纸张颗粒、无文字、无 Logo、无人物、无 3D 球体、无体积光、无 UI 边框；每张只用构图变化表达状态，不模拟嘴型或说话。状态差异分别是开放、汇聚、暴露缺口、收拢、确认。

原始生成文件保存在：

- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-008a4d58-2cd7-4803-b84b-b52b8565550f.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-f0c28542-89da-4c63-bb7e-3736cbf4ae01.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-6d83619a-3fbf-4731-8061-7f0b523da700.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-05c780c5-6e6f-42ad-a802-85c7639016b6.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-8f2a81a3-ad79-4b9e-9350-d4de6a3f81ca.png`

正式品牌资产仍只允许进入 `public/brand/`，并必须通过 `config/activity.ts` 的精确授权白名单。

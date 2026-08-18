# Hub 平面美术资产

本目录仅存放公共 Hub 的原创、仓库绑定平面资产，不含活动正式 Logo、参考图切片或 OCR 文案。

| 文件 | 用途 | 来源 |
| --- | --- | --- |
| `paper-atlas-texture.png` | 连续长卷的低对比纸张肌理 | 2026-08-17 由 OpenAI ImageGen 按 Evidence Atlas 方向生成；2026-08-17 优化为 627×627、256 色量化同名 PNG |
| `flat-coach-field.png` | 未接线备用（原登记“Hero 与五状态复用”，实际代码零引用；保留文件不删除） | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `evidence-target.png` | “发现真实问题”章节的证据定位靶 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `problem-seed.png` | 终局 CTA 的平面纸艺问题种子 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA |
| `coach-state-idle.webp` | Coach 静候：开放但安静的蓝色等高线场 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254；同日转 WebP q85 |
| `coach-state-listening.webp` | Coach 倾听：向中心汇聚的证据轨迹 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254；同日转 WebP q85 |
| `coach-state-challenging.webp` | Coach 质询：明确暴露白色缺口的断裂结构 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254；同日转 WebP q85 |
| `coach-state-condensing.webp` | Coach 凝结：散片收束为单一问题种子 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254；同日转 WebP q85 |
| `coach-state-confirmed.webp` | Coach 已确认：纸艺种子与稳定轨道 | 2026-08-17 由 OpenAI ImageGen 生成，透明 RGBA，1254 × 1254；同日转 WebP q85 |

## 2026-08-17 体积优化记录(K3 第二阶段）

工具：python3 + Pillow 12.2.0。质量校验：PSNR 在页面底色 `#f7f8fb` 上合成后逐像素计算，并排对比图存 `docs/audit/shots-k3/asset-compare-*.png`。

| 文件 | 转换 | 原体积 | 现体积 | 幅度 | PSNR |
| --- | --- | --- | --- | --- | --- |
| `coach-state-idle.png → .webp` | WebP q85 method=6，原尺寸 1254² | 1,597,029 B | 423,172 B | -73.5% | 36.22 dB |
| `coach-state-listening.png → .webp` | 同上 | 1,484,194 B | 507,448 B | -65.8% | 39.73 dB |
| `coach-state-challenging.png → .webp` | 同上 | 1,836,252 B | 496,726 B | -72.9% | 36.47 dB |
| `coach-state-condensing.png → .webp` | 同上 | 2,087,206 B | 649,588 B | -68.9% | 37.93 dB |
| `coach-state-confirmed.png → .webp` | 同上 | 995,524 B | 299,388 B | -69.9% | 37.93 dB |
| 五图合计 | | 8,000,205 B | 2,376,322 B | -70.3% | |
| `paper-atlas-texture.png`（同名原地优化） | 1254²→627² + 256 色 MEDIANCUT 量化 + Floyd–Steinberg 抖动，仍为 PNG，CSS 引用零改动 | 2,478,412 B | 368,055 B | -85.2% | 37.67 dB（升回 1254² 后对比） |

说明：纹理若改 WebP(q85 约 157 KB）需同步 `styles/tokens.css` 两处背景 url，本次选择同名 PNG 原地优化以避免跨分工改动；后续可再评估。五张状态图引用已同步至 `components/hub/coach-orb.tsx` 的 `COACH_STATE_ART`，原 PNG 已删除（生成原件见下述 .codex 路径）。

## 生成方向

五张状态资产均使用 Codex 内置 ImageGen 生成。共同提示词骨架为：暖白透明画布、深海军蓝与克制钴蓝、航空工程图纸与证据图谱语汇、平面丝网印刷与纸张颗粒、无文字、无 Logo、无人物、无 3D 球体、无体积光、无 UI 边框；每张只用构图变化表达状态，不模拟嘴型或说话。状态差异分别是开放、汇聚、暴露缺口、收拢、确认。

原始生成文件保存在：

- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-008a4d58-2cd7-4803-b84b-b52b8565550f.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-f0c28542-89da-4c63-bb7e-3736cbf4ae01.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-6d83619a-3fbf-4731-8061-7f0b523da700.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-05c780c5-6e6f-42ad-a802-85c7639016b6.png`
- `/Users/Zhuanz/.codex/generated_images/01a00bc8-f169-7bc0-910e-649894d3960d/exec-8f2a81a3-ad79-4b9e-9350-d4de6a3f81ca.png`

正式品牌资产仍只允许进入 `public/brand/`，并必须通过 `config/activity.ts` 的精确授权白名单。

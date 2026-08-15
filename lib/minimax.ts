// MiniMax 生图 Provider:为里程碑时刻生成专属插画("盲盒"仪式感)。
// 服务端专属;无Key时回退到确定性SVG艺术,保证离线演示完整。

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ART_DIR = process.env.ART_DIR || "data/art";

export function minimaxConfig() {
  return {
    apiKey:
      process.env.MINIMAX_API_KEY ||
      process.env["Minimax_API_key"] ||
      "",
    baseUrl: (process.env.MINIMAX_BASE_URL || "https://api.minimax.chat").replace(/\/+$/, ""),
    model: process.env.MINIMAX_MODEL || "image-01",
    timeoutMs: 60_000,
  };
}

export function isMinimaxEnabled(): boolean {
  return !!minimaxConfig().apiKey;
}

/** 各场景的提示词:统一扁平插画风格,内容取自项目真实信息,模型输出本身即"未知惊喜" */
export function buildArtPrompt(input: {
  scene: string;
  title?: string;
  track?: string | null;
  hint?: string;
}): string {
  const style = "扁平矢量插画,柔和靛蓝紫与暖金配色,干净浅色背景,构图留白,高质量,无文字";
  const subject =
    input.scene === "submit"
      ? `庆祝场景:一个小小的发明家站在完成的作品前,身后是展开的卷轴与彩带`
      : input.scene.startsWith("step-")
        ? `探索场景:一位年轻的探索者在${input.track ?? "未知"}领域迈出新的一步,身边有发光的路径指引`
        : `成就场景:一枚发光的徽章悬在空中,周围环绕象征${input.hint ?? "进步"}的意象`;
  const context = input.title ? `主题呼应「${input.title}」` : "";
  return `${subject},${context},${style}`;
}

/** 调用MiniMax生图并下载原图字节 */
export async function generateWithMinimax(prompt: string): Promise<{ buffer: Buffer; ext: string; provider: string }> {
  const cfg = minimaxConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.baseUrl}/v1/image_generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`, // 仅服务端
      },
      body: JSON.stringify({ model: cfg.model, prompt, aspect_ratio: "1:1" }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`MiniMax HTTP ${res.status}:${t.slice(0, 160)}`);
    }
    const data = (await res.json()) as {
      base_resp?: { status_code?: number; status_msg?: string };
      data?: { image_urls?: string[] };
    };
    if (data.base_resp?.status_code && data.base_resp.status_code !== 0) {
      throw new Error(`MiniMax ${data.base_resp.status_code}:${data.base_resp.status_msg}`);
    }
    const url = data.data?.image_urls?.[0];
    if (!url) throw new Error("MiniMax 未返回图片");
    const img = await fetch(url);
    if (!img.ok) throw new Error(`下载生图失败 HTTP ${img.status}`);
    return { buffer: Buffer.from(await img.arrayBuffer()), ext: ".jpeg", provider: "minimax" };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 无Key回退:确定性SVG艺术(种子=提示词哈希,同题同图) ---------- */

const SEED_EMOJI = ["🧭", "🎯", "🔁", "🧪", "🚀", "🏆", "💡", "🔭", "🎨", "⚙️"];
const SEED_PALETTES = [
  ["#4f46e5", "#a855f7", "#f59e0b"],
  ["#0ea5e9", "#6366f1", "#22c55e"],
  ["#f43f5e", "#8b5cf6", "#f59e0b"],
  ["#06b6d4", "#3b82f6", "#a78bfa"],
];

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function mockArtSvg(prompt: string): string {
  const seed = hashSeed(prompt);
  const [c1, c2, c3] = SEED_PALETTES[seed % SEED_PALETTES.length];
  const emoji = SEED_EMOJI[seed % SEED_EMOJI.length];
  const r = (n: number, mod: number) => ((seed >> n) % mod) + 1;
  const circles = Array.from({ length: 6 }, (_, i) => {
    const cx = 60 + ((seed >> (i * 3)) % 340);
    const cy = 60 + ((seed >> (i * 5)) % 340);
    const rad = 18 + ((seed >> (i * 7)) % 56);
    const op = 0.08 + ((seed >> i) % 12) / 100;
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${[c1, c2, c3][i % 3]}" opacity="${op}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 460 460">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/>
</linearGradient></defs>
<rect width="460" height="460" rx="28" fill="url(#g)"/>
<rect width="460" height="460" rx="28" fill="#ffffff" opacity="0.12"/>
${circles}
<g transform="rotate(${r(2, 24) - 12} 230 230)">
<circle cx="230" cy="222" r="${86 + r(4, 20)}" fill="#ffffff" opacity="0.92"/>
<text x="230" y="248" font-size="96" text-anchor="middle">${emoji}</text>
</g>
<text x="230" y="418" font-size="20" text-anchor="middle" fill="#ffffff" opacity="0.85" font-family="sans-serif">AI ART · OFFLINE MODE</text>
</svg>`;
  return svg;
}

export async function generateMockArt(prompt: string): Promise<{ buffer: Buffer; ext: string; provider: string }> {
  return { buffer: Buffer.from(mockArtSvg(prompt), "utf-8"), ext: ".svg", provider: "mock" };
}

/** 供单测使用的种子哈希 */
export const hashSeedForTest = hashSeed;

/** 统一入口:落盘到 data/art,返回文件名 */
export async function generateAndStore(prompt: string): Promise<{ file: string; provider: string }> {
  const result = isMinimaxEnabled() ? await generateWithMinimax(prompt) : await generateMockArt(prompt);
  const file = `${randomUUID()}${result.ext}`;
  await mkdir(ART_DIR, { recursive: true });
  await writeFile(path.join(ART_DIR, file), result.buffer);
  return { file, provider: result.provider };
}

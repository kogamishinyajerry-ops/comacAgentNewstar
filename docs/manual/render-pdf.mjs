#!/usr/bin/env node
/**
 * 一次性工具脚本:参赛者手册 Markdown → 打印版 HTML → PDF。
 *
 * 用法:  node docs/manual/render-pdf.mjs
 * 输入:  docs/manual/参赛者手册-v0.1.md
 * 输出:  docs/manual/参赛者手册-v0.1.pdf
 *
 * 说明:
 * - 依赖仓库已安装的 playwright(chromium);不进应用代码路径,不参与构建。
 * - 内置一个仅覆盖本手册所用语法子集的 MD→HTML 转换器
 *   (标题/段落/无序与有序列表/表格/引用/围栏代码块/分隔线/粗体/行内代码),
 *   手册若新增语法请先扩充 convert()。
 * - 中文字体使用系统字体栈;A4 版式,页脚含手册标识与页码。
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUT = path.join(HERE, "参赛者手册-v0.1.md");
const OUTPUT = path.join(HERE, "参赛者手册-v0.1.pdf");

/* ---------- 最小 MD→HTML 转换器(仅支持本手册用到的子集) ---------- */

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 行内格式:先转义,再应用粗体与行内代码 */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function isTableSeparator(line) {
  return /^\|[\s:|-]+\|$/.test(line.trim());
}

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function convert(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // 围栏代码块
    if (line.trim().startsWith("```")) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过收尾 ```
      out.push(`<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    // 标题
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    // 分隔线
    if (/^---\s*$/.test(line.trim())) {
      out.push("<hr>");
      i += 1;
      continue;
    }

    // 表格(连续 | 开头行;第二行是分隔行)
    if (line.trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headerCells = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      const thead = `<thead><tr>${headerCells.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("")}</tbody>`;
      out.push(`<table>${thead}${tbody}</table>`);
      continue;
    }

    // 引用块(连续 > 行)
    if (line.trim().startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      out.push(`<blockquote>${buf.map((b) => inline(b)).join("<br>")}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*-\s+/, ""));
        i += 1;
      }
      out.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      out.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }

    // 普通段落(合并连续非空行)
    const buf = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,3}\s|>|```|\||---\s*$|\s*-\s+|\s*\d+\.\s+)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i += 1;
    }
    out.push(`<p>${buf.map((b) => inline(b)).join("<br>")}</p>`);
  }

  return out.join("\n");
}

/* ---------- 打印版 HTML(自包含,系统字体栈) ---------- */

function buildHtml(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>COMAC 青年 AI Agent 创新实践月 · 参赛者手册 v0.1</title>
<style>
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC",
      "Hiragino Sans GB", "Source Han Sans SC", "Noto Sans CJK SC",
      "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
    font-size: 10.5pt;
    line-height: 1.8;
    color: #1f2329;
    margin: 0;
  }
  h1 {
    font-size: 19pt;
    line-height: 1.4;
    text-align: center;
    margin: 0 0 10pt;
    padding-bottom: 10pt;
    border-bottom: 2px solid #1f2329;
  }
  h1 + blockquote {
    text-align: center;
    border: none;
    padding: 0;
    margin: 0 0 18pt;
    color: #555;
    font-size: 9.5pt;
  }
  h2 {
    font-size: 14pt;
    margin: 20pt 0 8pt;
    padding-bottom: 4pt;
    border-bottom: 1px solid #c9cdd4;
  }
  h3 {
    font-size: 11.5pt;
    margin: 14pt 0 6pt;
  }
  p { margin: 6pt 0; }
  ul, ol { margin: 6pt 0; padding-left: 1.6em; }
  li { margin: 3pt 0; }
  blockquote {
    margin: 8pt 0;
    padding: 4pt 12pt;
    border-left: 3px solid #c9cdd4;
    color: #444;
  }
  code {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, "Courier New", monospace;
    font-size: 9pt;
    background: #f2f3f5;
    padding: 0 3px;
    border-radius: 3px;
  }
  pre {
    background: #f7f8fa;
    border: 1px solid #e3e6eb;
    border-radius: 6px;
    padding: 10pt 12pt;
    font-size: 8.5pt;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  pre code { background: none; padding: 0; font-size: inherit; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    margin: 8pt 0;
    font-size: 9.5pt;
  }
  th, td {
    border: 1px solid #c9cdd4;
    padding: 5pt 7pt;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
    overflow-wrap: anywhere;
  }
  th { background: #f2f3f5; font-weight: 600; }
  hr { border: none; border-top: 1px solid #c9cdd4; margin: 16pt 0; }
  h2, h3 { page-break-after: avoid; }
  table, pre { page-break-inside: avoid; }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/* ---------- 主流程 ---------- */

const md = await readFile(INPUT, "utf8");
const html = buildHtml(convert(md));

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: OUTPUT,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="width:100%;font-size:7.5pt;color:#8a8f99;padding:0 16mm;display:flex;justify-content:space-between;font-family:'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;">
        <span>COMAC 青年 AI Agent 创新实践月 · 参赛者手册 v0.1(初稿,以活动正式通知为准)</span>
        <span>第 <span class="pageNumber"></span> / <span class="totalPages"></span> 页</span>
      </div>`,
  });
  console.log(`PDF 已生成: ${OUTPUT}`);
} finally {
  await browser.close();
}

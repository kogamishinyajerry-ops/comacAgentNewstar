"use client";

/* 实机演示引擎:虚拟鼠标在真实页面上移动、点击、逐字输入,
   触发的是真实事件——表单保存、过步彩带、成就Toast、插画盲盒全部真实响应。 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "./ui";

/* ---------------- 引擎 ---------------- */

interface RunnerCtx {
  moveTo(el: Element, label?: string): Promise<void>;
  click(el: Element, label?: string): Promise<void>;
  type(el: HTMLInputElement | HTMLTextAreaElement, text: string, label?: string): Promise<void>;
  fillVisibleFields(values: string[]): Promise<void>;
  waitFor(check: () => Element | null, timeoutMs?: number): Promise<Element | null>;
  goto(path: string): Promise<void>;
  url(): string;
  sleep(ms: number): Promise<void>;
  byButtonText(text: string, exact?: boolean): Element | null;
  speed: number;
}

/** 主内容区可见的文本输入框(按DOM顺序=配置顺序) */
function visibleTextInputs(): Element[] {
  return [...document.querySelectorAll("main input:not([type=checkbox]):not([type=radio]):not([type=password]):not([type=email]):not([type=number]):not([type=file]), main textarea")].filter(
    (el) => (el as HTMLElement).offsetParent !== null && !(el as HTMLInputElement).disabled && (el as HTMLInputElement).readOnly !== true
  );
}

class Cancelled extends Error {}

/* 逐字输入:走浏览器原生输入路径(execCommand),派发的是真实 input 事件,
   React/受控组件100%响应(合成 Event 在部分受控输入上会被忽略)。 */
async function typeInto(el: HTMLInputElement | HTMLTextAreaElement, text: string, charDelayMs: number) {
  el.focus();
  el.select?.();
  document.execCommand("delete");
  for (const ch of text) {
    const ok = document.execCommand("insertText", false, ch);
    if (!ok) {
      // 极端环境兜底:原生setter+事件
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, el.value + ch);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ch }));
    }
    await new Promise((r) => setTimeout(r, charDelayMs + Math.random() * 24));
  }
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function createRunner(opts: {
  cursor: HTMLDivElement | null;
  setNarration: (t: string) => void;
  setProgress: (cur: number, total: number) => void;
  getSpeed: () => number;
  isCancelled: () => boolean;
  push: (path: string) => void;
}) {
  const pos = { x: window.innerWidth / 2, y: window.innerHeight * 0.4 };
  let raf = 0;

  const ensureAlive = () => {
    if (opts.isCancelled()) throw new Cancelled();
  };

  const setLabel = (text?: string) => {
    if (!opts.cursor) return;
    const label = opts.cursor.querySelector(".demo-cursor-label");
    if (label) label.textContent = text ?? "";
    opts.cursor.classList.toggle("demo-cursor-labeled", !!text);
  };

  const place = () => {
    opts.cursor?.style.setProperty("transform", `translate3d(${pos.x}px, ${pos.y}px, 0)`);
  };

  const ripple = () => {
    const r = document.createElement("div");
    r.className = "demo-ripple";
    r.style.left = `${pos.x}px`;
    r.style.top = `${pos.y}px`;
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 560);
  };

  const ctx: RunnerCtx = {
    speed: 1,
    async sleep(ms: number) {
      const step = 80;
      let waited = 0;
      const total = ms / opts.getSpeed();
      while (waited < total) {
        ensureAlive();
        await new Promise((r) => setTimeout(r, Math.min(step, total - waited)));
        waited += step;
      }
    },
    async moveTo(el, label) {
      ensureAlive();
      setLabel(label);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      await new Promise((r) => setTimeout(r, 260 / opts.getSpeed()));
      const rect = el.getBoundingClientRect();
      const tx = rect.left + Math.min(rect.width * 0.5, 120);
      const ty = rect.top + Math.min(rect.height * 0.55, 40);
      const dist = Math.hypot(tx - pos.x, ty - pos.y);
      const dur = Math.max(240, Math.min(760, dist * 1.15)) / opts.getSpeed();
      const sx = pos.x, sy = pos.y;
      // 轻微弧线,更像人手
      const arc = Math.min(46, dist * 0.14) * (Math.random() > 0.5 ? 1 : -1);
      const t0 = performance.now();
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          if (opts.isCancelled()) return resolve();
          const t = Math.min(1, (now - t0) / dur);
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          pos.x = sx + (tx - sx) * e;
          pos.y = sy + (ty - sy) * e - Math.sin(Math.PI * t) * arc;
          place();
          if (t < 1) raf = requestAnimationFrame(frame);
          else resolve();
        };
        raf = requestAnimationFrame(frame);
      });
    },
    async click(el, label) {
      await this.moveTo(el, label);
      ripple();
      (el as HTMLElement).click();
      setLabel();
      await this.sleep(240);
    },
    async type(el, text, label) {
      await this.moveTo(el, label);
      ripple();
      await typeInto(el, text, 26 / opts.getSpeed());
      setLabel();
    },
    async fillVisibleFields(values) {
      const fields = visibleTextInputs();
      for (let i = 0; i < Math.min(values.length, fields.length); i++) {
        await this.type(fields[i] as HTMLInputElement, values[i]);
      }
    },
    async waitFor(check, timeoutMs = 8000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        ensureAlive();
        const el = check();
        if (el) return el;
        await new Promise((r) => setTimeout(r, 240));
      }
      return null;
    },
    async goto(path) {
      ensureAlive();
      opts.push(path);
      await this.waitFor(() => (location.pathname === path ? document.body : null), 6000);
      await this.sleep(500);
    },
    url() {
      return location.pathname + location.search;
    },
    byButtonText(text, exact = false) {
      const btns = [...document.querySelectorAll("button, a")];
      return btns.find((b) => {
        const t = (b.textContent ?? "").trim();
        return exact ? t === text : t.includes(text) && t.length < text.length + 14;
      }) ?? null;
    },
  };

  const dispose = () => cancelAnimationFrame(raf);
  return { ctx, dispose, place };
}

/* ---------------- 演示脚本 ---------------- */

const S2_VALUES = ["2026-08-20起,每晚1小时", "无,从零开始", "提示词、脚本与测试案例", "GLM API、开源解析库", "无"];
const S4_VALUES = [
  "新入职的结构设计工程师",
  "每次评审前要把两个系统的变更记录手工拼成对比说明",
  "每周2—3次,每次约40分钟",
  "导出CSV→复制到表格→逐行核对→手工排版",
  "两系统字段名不一致,人工对错行后返工",
  "每周约2小时,每月1次错漏",
  "省下的时间可用于复核关键变更",
];
const S5_VALUES = ["无事实错误,10分钟内可确认", "条目遗漏、日期或责任人有错", "以两系统导出原始记录为准", "两份已脱敏CSV", "一页Markdown对比说明", "行数对不上、字段缺失", "①常规 ②同日多条 ③空导出"];

interface ScriptStep {
  say: string;
  progress?: [number, number];
  run: (c: RunnerCtx) => Promise<void>;
}

/** 点击"下一步"并等待步骤推进:先等防抖自动保存落库,失败重试一次 */
async function gotoNext(c: RunnerCtx, targetStep: number): Promise<boolean> {
  await c.sleep(1500);
  for (let i = 0; i < 2; i++) {
    const next = c.byButtonText("下一步 →");
    if (!next) return false;
    await c.click(next, "下一步");
    const hit = await c.waitFor(() => (location.search.includes(`step=${targetStep}`) ? document.body : null), 6000);
    if (hit) return true;
    await c.sleep(1500); // 给保存与门禁再来一次的机会
  }
  return false;
}

function buildScript(demoUser: { name: string; email: string }): ScriptStep[] {
  return [
    {
      say: "👋 你好,我是虚拟鼠标——接下来由我代你操作,所有响应都是真实的",
      progress: [1, 10],
      run: async (c) => c.sleep(1800),
    },
    {
      say: "先注册一个演示账号",
      progress: [2, 10],
      run: async (c) => {
        await c.goto("/register");
        const fields = visibleTextInputs();
        if (fields[0]) await c.type(fields[0] as HTMLInputElement, demoUser.name, "填写姓名");
        const email = document.querySelector('input[type="email"]') as HTMLInputElement | null;
        if (email) await c.type(email, demoUser.email, "填写邮箱");
        const pwd = document.querySelector('input[type="password"]') as HTMLInputElement | null;
        if (pwd) await c.type(pwd, "demo123456", "设置密码");
      },
    },
    {
      say: "提交注册,进入工作台",
      progress: [3, 10],
      run: async (c) => {
        const btn = await c.waitFor(() => c.byButtonText("注册并开始"));
        if (btn) await c.click(btn, "点击注册");
        await c.waitFor(() => (location.pathname === "/projects" ? document.body : null), 8000);
      },
    },
    {
      say: "这是你的工作台:段位、成就、最小下一步,一屏可见",
      progress: [4, 10],
      run: async (c) => c.sleep(2200),
    },
    {
      say: "创建队伍(单人可参赛)",
      progress: [5, 10],
      run: async (c) => {
        await c.goto("/projects/new-team");
        const fields = visibleTextInputs();
        if (fields[0]) await c.type(fields[0] as HTMLInputElement, "演示小分队", "队名");
        const btn = await c.waitFor(() => c.byButtonText("创建队伍"));
        if (btn) await c.click(btn);
        await c.waitFor(() => (location.pathname === "/projects" ? document.body : null), 8000);
      },
    },
    {
      say: "新建一个想法",
      progress: [6, 10],
      run: async (c) => {
        const btn = await c.waitFor(() => c.byButtonText("+ 新建想法"));
        if (btn) await c.click(btn, "新建想法");
        const input = await c.waitFor(() => document.querySelector('input[placeholder^="想法名称"]'));
        if (input) await c.type(input as HTMLInputElement, "演示:变更对比小助手", "想法名称");
        const create = await c.waitFor(() => c.byButtonText("创建", true));
        if (create) await c.click(create, "创建");
        await c.waitFor(() => (location.search.includes("step=1") ? document.body : null), 8000);
      },
    },
    {
      say: "第1步:确认三项承诺",
      progress: [7, 10],
      run: async (c) => {
        const boxes = [...document.querySelectorAll('input[type="checkbox"]')].filter((el) => (el as HTMLElement).offsetParent !== null);
        for (const b of boxes) {
          const r = b.getBoundingClientRect();
          await c.moveTo(b, "勾选承诺");
          rippleAt(r.left + r.width / 2, r.top + r.height / 2);
          (b as HTMLElement).click();
          await c.sleep(340);
        }
      },
    },
    {
      say: "过步!注意右上角的完成提示与彩带",
      progress: [8, 10],
      run: async (c) => {
        const next = await c.waitFor(() => c.byButtonText("下一步 →"));
        if (next) await c.click(next, "下一步");
        await c.waitFor(() => (location.search.includes("step=2") ? document.body : null), 6000);
        await c.sleep(1200);
      },
    },
    {
      say: "第2步:如实填写原创披露",
      progress: [9, 10],
      run: async (c) => {
        if (!c.url().includes("step=2")) return;
        await c.fillVisibleFields(S2_VALUES);
        await gotoNext(c, 3);
      },
    },
    {
      say: "第3步:选择赛道",
      progress: [10, 10],
      run: async (c) => {
        if (!c.url().includes("step=3")) return;
        const track = await c.waitFor(() => {
          // 赛道卡片按钮文本以赛道名开头(后续跟长文案)
          const hits = [...document.querySelectorAll("button")].filter((b) => (b.textContent ?? "").trim().replace(/\s+/g, " ").startsWith("知识问答助手"));
          return hits[0] ?? null;
        });
        if (track) await c.click(track, "选择赛道");
        await c.sleep(600);
        await gotoNext(c, 4);
      },
    },
    {
      say: "第4步:描述真问题——最小下一步会实时更新",
      progress: [11, 12],
      run: async (c) => {
        if (!c.url().includes("step=4")) return;
        await c.fillVisibleFields(S4_VALUES);
        await gotoNext(c, 5);
      },
    },
    {
      say: "里程碑达成!看看专属插画盲盒(随时可跳过)",
      progress: [12, 12],
      run: async (c) => {
        if (!c.url().includes("step=5")) return;
        const overlayBtn = await c.waitFor(() => {
          const inOverlay = [...document.querySelectorAll("button")].filter((b) => (b.textContent ?? "").trim() === "继续" && b.closest(".no-print") && b.parentElement?.className.includes("rounded-2xl"));
          return inOverlay[0] ?? null;
        }, 15000);
        if (overlayBtn) {
          await c.sleep(2400); // 展示加载仪式
          await c.moveTo(overlayBtn, "收下插画");
          const r = (overlayBtn as HTMLElement).getBoundingClientRect();
          rippleAt(r.left + r.width / 2, r.top + r.height / 2);
          (overlayBtn as HTMLElement).click();
        }
        await c.sleep(800);
      },
    },
  ];
}

/* 工具:脚本内的小彩点 */
function rippleAt(x: number, y: number) {
  const r = document.createElement("div");
  r.className = "demo-ripple";
  r.style.left = `${x}px`;
  r.style.top = `${y}px`;
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 560);
}

/* ---------------- 播放器组件 ---------------- */

const DEMO_EVENT = "ynav-demo-start";

export function startDemo() {
  window.dispatchEvent(new CustomEvent(DEMO_EVENT));
}

export function DemoPlayer() {
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [narration, setNarration] = useState("");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [speed, setSpeed] = useState(1);
  const [done, setDone] = useState(false);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const cancelledRef = useRef(false);
  const speedRef = useRef(1);
  const runnerRef = useRef<ReturnType<typeof createRunner> | null>(null);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const stop = useCallback(() => {
    cancelledRef.current = true;
    setActive(false);
    setDone(false);
    setNarration("");
  }, []);

  const play = useCallback(async () => {
    cancelledRef.current = false;
    setActive(true);
    setDone(false);
    const user = { name: "演示玩家", email: `demo-${Date.now().toString(36)}@demo.test` };
    const runner = createRunner({
      cursor: cursorRef.current,
      setNarration,
      setProgress: (cur, total) => setProgress([cur, total]),
      getSpeed: () => speedRef.current,
      isCancelled: () => cancelledRef.current,
      push: (path) => router.push(path),
    });
    runnerRef.current = runner;
    try {
      const steps = buildScript(user);
      for (const step of steps) {
        if (cancelledRef.current) break;
        setNarration(step.say);
        if (step.progress) setProgress(step.progress);
        await step.run(runner.ctx);
      }
      if (!cancelledRef.current) {
        setNarration("演示完毕 🎉 演示账号与进度已保留,现在轮到你了");
        setDone(true);
      }
    } catch (e) {
      if (!(e instanceof Cancelled)) {
        setNarration(`演示在此处中断(${e instanceof Error ? e.message.slice(0, 60) : "未知"}),你可以继续手动操作`);
        setDone(true);
      }
    } finally {
      runner.dispose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 演示脚本为一次性闭包,router引用稳定
  }, []);

  useEffect(() => {
    const onStart = () => play();
    window.addEventListener(DEMO_EVENT, onStart);
    // ?demo=1 直链自动播放
    if (new URLSearchParams(location.search).get("demo") === "1") {
      const t = setTimeout(() => play(), 900);
      return () => {
        clearTimeout(t);
        window.removeEventListener(DEMO_EVENT, onStart);
      };
    }
    return () => window.removeEventListener(DEMO_EVENT, onStart);
  }, [play]);

  useEffect(() => () => runnerRef.current?.dispose(), []);

  return (
    <>
      {/* 虚拟鼠标 */}
      <div ref={cursorRef} className={cn("demo-cursor", !active && "hidden")} aria-hidden>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
          <path d="M5 3l14 7.5-6.2 1.6L9.9 18 5 3z" fill="#4f46e5" stroke="white" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        <span className="demo-cursor-label" />
      </div>

      {/* 解说HUD */}
      {active && (
        <div className="no-print fixed bottom-4 left-1/2 z-[10051] flex -translate-x-1/2 items-center gap-3 rounded-full border border-slate-700/40 bg-slate-900/90 px-4 py-2 text-white shadow-2xl backdrop-blur">
          <span className="flex h-6 w-6 shrink-0 animate-pulse items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold">▶</span>
          <p className="max-w-[420px] truncate text-xs font-medium">{narration}</p>
          {progress[1] > 0 && (
            <span className="tnum shrink-0 text-[10px] text-slate-400">
              {progress[0]}/{progress[1]}
            </span>
          )}
          <button
            className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold hover:bg-white/20"
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 3 : 1))}
            title="演示速度"
          >
            {speed}x
          </button>
          <button className="shrink-0 rounded-full bg-red-500/80 px-2 py-0.5 text-[10px] font-semibold hover:bg-red-500" onClick={stop}>
            停止
          </button>
        </div>
      )}

      {/* 演示完毕 */}
      {done && (
        <div className="fixed inset-0 z-[10052] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="anim-pop-in w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <div className="anim-float mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-4xl ring-1 ring-brand-200">🎬</div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">演示完毕</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-500">
              虚拟鼠标完成了注册、组队、建想法到第4步的全真实操作。当前登录的是演示账号,
              你可以直接继续往下走,也可以退出后注册自己的账号。
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button
                className="inline-flex h-9 items-center rounded-md bg-brand-600 px-5 text-[13px] font-medium text-white hover:bg-brand-700"
                onClick={() => {
                  setDone(false);
                  setActive(false);
                  // 兜底:关闭可能仍开着的插画盲盒
                  [...document.querySelectorAll("button")]
                    .filter((b) => (b.textContent ?? "").trim() === "继续" && b.closest(".fixed.inset-0"))
                    .forEach((b) => (b as HTMLElement).click());
                }}
              >
                我来接着操作
              </button>
              <button
                className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-[13px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setDone(false);
                  setActive(false);
                  router.push("/");
                }}
              >
                回到首页
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- 启动按钮(公共页显示) ---------------- */

export function DemoLauncher() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const pub = ["/", "/login", "/register"].includes(location.pathname);
    setShow(pub);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={startDemo}
      className="no-print anim-glow-pulse fixed bottom-5 right-5 z-[10048] inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-700 px-5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(79,70,229,0.45)] transition-transform hover:scale-105 active:scale-95"
      title="观看虚拟鼠标实机演示"
    >
      <span className="text-base">▶</span> 实机演示
    </button>
  );
}

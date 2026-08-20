import type { Config } from "tailwindcss";

/**
 * 设计系统 v2 token 映射(2026-08-20 Act 5)。
 * 原则:只增不破——brand/ink/paper/display 等既有键原样保留,
 * 新增的 cobalt/navy、排版尺度、阴影、easing、动画供双路由组共用。
 * 详细用法见 docs/design-system-v2.md。
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* 品牌主色:朱砂(vermilion)——纸墨之上的一点印泥红 */
        brand: {
          50: "#faf1ec",
          100: "#f3ddd1",
          200: "#e6b9a3",
          300: "#d68f70",
          400: "#c76a45",
          500: "#b94a26",
          600: "#a03e20",
          700: "#7c2f18",
        },
        /* 墨与纸(旧 app 路由组) */
        ink: {
          50: "#f6f5f2",
          100: "#e8e6e0",
          200: "#d4d0c7",
          300: "#b0aa9c",
          400: "#8a8375",
          500: "#6b6457",
          600: "#4d473c",
          700: "#38332b",
          800: "#26221d",
          900: "#1c1917",
        },
        paper: "#f7f4ec",
        /* 钴蓝(hub 唯一高饱和动作色,与 --accent-coach 同源) */
        cobalt: {
          50: "#eef3fd",
          100: "#dce7fb",
          200: "#b9cef5",
          300: "#8dabeb",
          400: "#6084de",
          500: "#3568e8",
          600: "#2b55c9",
          700: "#2147b3",
          800: "#1d3a8f",
          900: "#1a2f6e",
        },
        /* 海军蓝墨阶(hub 文字/结构,与 --text-primary 同源) */
        navy: {
          50: "#f2f4f8",
          100: "#e3e7ee",
          200: "#c6cdd9",
          300: "#9aa5b8",
          400: "#77839a",
          500: "#596477",
          600: "#45526b",
          700: "#2e3b55",
          800: "#1f2c47",
          900: "#172238",
          950: "#0f1729",
        },
        canvas: "#f4f1e9",
      },
      fontFamily: {
        display: [
          '"Songti SC"',
          '"STSong"',
          '"Noto Serif SC"',
          '"Noto Serif CJK SC"',
          '"Source Han Serif SC"',
          "Georgia",
          "serif",
        ],
        hub: [
          '"PingFang SC"',
          '"Noto Sans CJK SC"',
          '"Microsoft YaHei"',
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
      },
      /* 排版尺度:display 用宋体,正文用无衬线;数字一律 tnum */
      fontSize: {
        "display-xl": [
          "clamp(40px, 4.7vw, 66px)",
          { lineHeight: "1.16", letterSpacing: "-0.025em", fontWeight: "700" },
        ],
        "display-lg": [
          "clamp(28px, 3vw, 38px)",
          { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "700" },
        ],
        "display-md": [
          "clamp(22px, 2.4vw, 30px)",
          { lineHeight: "1.42", letterSpacing: "-0.01em", fontWeight: "700" },
        ],
        lead: ["clamp(16px, 1.35vw, 18px)", { lineHeight: "1.72" }],
        body: ["15.5px", { lineHeight: "1.72" }],
        caption: ["13px", { lineHeight: "1.6" }],
        micro: ["11px", { lineHeight: "1.5", letterSpacing: "0.06em" }],
      },
      /* 层叠阴影:近处 hairline + 远处软阴影,拒绝生硬单影 */
      boxShadow: {
        hairline: "0 0 0 1px rgba(23, 34, 56, 0.08)",
        card: "0 1px 2px rgba(23, 34, 56, 0.05), 0 16px 40px -10px rgba(23, 34, 56, 0.08)",
        lift: "0 2px 4px rgba(23, 34, 56, 0.06), 0 24px 56px -12px rgba(23, 34, 56, 0.13)",
        overlay: "0 8px 24px rgba(23, 34, 56, 0.10), 0 32px 80px -16px rgba(23, 34, 56, 0.18)",
        btn: "0 1px 2px rgba(23, 34, 56, 0.12), 0 10px 24px -6px rgba(43, 85, 201, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
        "btn-hover":
          "0 2px 3px rgba(23, 34, 56, 0.12), 0 14px 32px -6px rgba(43, 85, 201, 0.36), inset 0 1px 0 rgba(255, 255, 255, 0.16)",
        "card-app":
          "0 1px 2px rgba(28, 25, 23, 0.05), 0 12px 32px -12px rgba(28, 25, 23, 0.12)",
      },
      transitionTimingFunction: {
        /* 丝绸感主 easing;spring 用于按压/吸附微回弹 */
        soft: "cubic-bezier(0.22, 1, 0.36, 1)",
        spring: "cubic-bezier(0.34, 1.4, 0.5, 1)",
        standard: "cubic-bezier(0.2, 0, 0, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        rise: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "none" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "none" },
        },
        stamp: {
          "0%": { transform: "scale(2.4) rotate(-18deg)", opacity: "0" },
          "55%": { transform: "scale(0.92) rotate(-8deg)", opacity: "1" },
          "75%": { transform: "scale(1.06) rotate(-8deg)" },
          "100%": { transform: "scale(1) rotate(-8deg)", opacity: "1" },
        },
        "check-draw": {
          from: { strokeDashoffset: "24" },
          to: { strokeDashoffset: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fade-in 240ms cubic-bezier(0.22, 1, 0.36, 1) both",
        rise: "rise 420ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
        stamp: "stamp 0.6s cubic-bezier(0.34, 1.4, 0.5, 1) 0.3s both",
        "check-draw": "check-draw 0.4s ease-out 0.5s both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;

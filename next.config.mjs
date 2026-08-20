/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 并行 dev 隔离:默认不变。另一会话同时跑 dev 时共享 .next 会互写清单
  // 导致路由间歇 404,此时以 NEXT_DIST_DIR=.next/live 之类切换独立目录。
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  async headers() {
    return [
      {
        // 公共站基础安全头(§19):防 MIME 嗅探、防点击劫持嵌套、收敛引用来源。
        // HSTS 与 CSP 全量策略属代理/网关层职责,不在应用层强行下发。
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;

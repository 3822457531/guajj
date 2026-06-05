import path from "path";

/**
 * 本地开发热更新：`npm run dev`（Next 默认 Fast Refresh + Turbopack）。
 * 若改代码不刷新（Docker 挂载卷、网络盘、少数 Windows 路径）：`npm run dev:poll`
 * 生产 `next start` / 当前 Dockerfile 无热更新，属正常。
 */
const poll =
  process.env.NEXT_DEV_POLL === "1" || process.env.NEXT_DEV_POLL === "true"
    ? { watchOptions: { pollIntervalMs: 1000 } }
    : {};

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_ADMIN_PATH_PREFIX: process.env.ADMIN_PATH_PREFIX ?? ""
  },
  turbopack: {
    root: path.resolve(".")
  },
  outputFileTracingRoot: path.resolve("."),
  /** collector 经 API 引用时勿打包进 bundle，运行时从 node_modules 加载 */
  serverExternalPackages: ["tesseract.js", "telegram", "input"],
  /**
   * 运行时写入 `public/uploads/…`（如 TG Webhook）在 `next start` 下偶发 404，重启才恢复：
   * 生产对静态资源的处理与 dev 不完全一致。将 `/uploads/*` 统一交给 API 按磁盘流式读取，避免依赖启动时扫描的 public 清单。
   */
  async rewrites() {
    return [{ source: "/uploads/:path*", destination: "/api/uploads/:path*" }];
  },
  /**
   * 用 http://127.0.0.1:3000 访问时，HMR / 开发字体等请求的 Origin 为 127.0.0.1，
   * 与默认放行的 localhost 不同，会被误判跨站。仅影响 `next dev`。
   */
  allowedDevOrigins: ["127.0.0.1"],
  ...poll
};

export default nextConfig;

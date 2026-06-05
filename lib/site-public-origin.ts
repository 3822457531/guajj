/**
 * 浏览器应访问的站点根 URL（无尾随 `/`）。
 * 反代到本机时 `request.url` 常为 `http://127.0.0.1:3000` 或错误的 `https://localhost:3000`，
 * OAuth 回调里若用它做 `redirect`，用户会被送回 localhost。
 *
 * 生产务必配置其一：`PUBLIC_BASE_URL`（推荐），或保证 `SUYANW_REDIRECT_URI` 为完整回调 URL（从此解析 origin）。
 */
export function getPublicSiteOrigin(request: Request): string {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;

  const suyanwRedirect = process.env.SUYANW_REDIRECT_URI?.trim();
  if (suyanwRedirect) {
    try {
      return new URL(suyanwRedirect).origin;
    } catch {
      /* ignore */
    }
  }

  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost && !/^localhost\b/i.test(forwardedHost) && !/^127\./.test(forwardedHost)) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return `${proto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

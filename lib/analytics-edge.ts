/** Edge / middleware 可用：勿引入 prisma、Node crypto 等 */

/** 不计入 PV 的路径：浏览器/工具自动请求，非用户浏览 */
export function shouldTrackPageVisit(pathname: string): boolean {
  const path = (pathname.split("?")[0]?.split("#")[0] ?? pathname).trim() || "/";
  if (path.startsWith("/.well-known/")) return false;
  if (path === "/robots.txt" || path === "/sitemap.xml") return false;
  return true;
}

/** Next.js 预取 / RSC 软导航，非用户主动打开页面 */
export function isPrefetchLikeRequest(headers: Headers): boolean {
  return (
    headers.get("RSC") === "1" ||
    headers.get("Next-Router-Prefetch") === "1" ||
    headers.get("Purpose") === "prefetch" ||
    headers.get("Sec-Purpose") === "prefetch"
  );
}

/** 仅统计用户真实打开的 HTML 页面（排除 Link 预取、RSC 飞行请求等） */
export function isDocumentNavigation(headers: Headers): boolean {
  if (isPrefetchLikeRequest(headers)) return false;
  const dest = headers.get("sec-fetch-dest");
  if (dest === "document") return true;
  if (dest && dest !== "empty") return false;
  const accept = headers.get("accept") ?? "";
  return accept.includes("text/html");
}

export function analyticsInternalSecret(): string {
  return process.env.ANALYTICS_INTERNAL_SECRET || process.env.AUTH_SECRET || "change-this-local-secret-before-production";
}

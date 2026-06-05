import { getPublicSiteOrigin } from "@/lib/site-public-origin";

/** HTTPS 下使用 None+Secure，减少从微信等第三方跳回时登录态 Cookie 丢失 */
export function oauthFlowCookieAttrs(request: Request): { sameSite: "none" | "lax"; secure: boolean } {
  const https = getPublicSiteOrigin(request).startsWith("https:");
  if (https) {
    return { sameSite: "none", secure: true };
  }
  return { sameSite: "lax", secure: false };
}

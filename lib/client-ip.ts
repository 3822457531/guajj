function ipFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const xri = headers.get("x-real-ip")?.trim();
  if (xri) return xri;

  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  return "unknown";
}

/** 从反代/边缘请求头解析客户端 IP */
export function getClientIp(request: Request): string {
  return ipFromHeaders(request.headers);
}

/** 从 next/headers 的 Headers 解析客户端 IP */
export function getClientIpFromHeaders(headers: Headers): string {
  return ipFromHeaders(headers);
}

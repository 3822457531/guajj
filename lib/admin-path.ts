const INTERNAL_ADMIN = "/admin";

function readPrefix(): string {
  const raw =
    process.env.ADMIN_PATH_PREFIX?.trim() ||
    process.env.NEXT_PUBLIC_ADMIN_PATH_PREFIX?.trim() ||
    "";
  if (!raw) return INTERNAL_ADMIN;
  const p = raw.startsWith("/") ? raw : `/${raw}`;
  return p.replace(/\/+$/, "") || INTERNAL_ADMIN;
}

/** 对外后台路径前缀（未配置时为 /admin，仅适合本地开发） */
export function getAdminPathPrefix(): string {
  return readPrefix();
}

export function isAdminObfuscated(): boolean {
  return getAdminPathPrefix() !== INTERNAL_ADMIN;
}

/** 将内部 /admin 路径转为对外隐蔽路径 */
export function mapLegacyAdminToPublic(pathname: string): string {
  const prefix = getAdminPathPrefix();
  if (prefix === INTERNAL_ADMIN) return pathname;
  if (pathname === INTERNAL_ADMIN || pathname.startsWith(`${INTERNAL_ADMIN}/`)) {
    return pathname.replace(INTERNAL_ADMIN, prefix);
  }
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) {
    return pathname.replace("/api/admin", `${prefix}/api`);
  }
  return pathname;
}

/** usePathname 在 rewrite 后常为内部路径，统一规范为对外路径 */
export function normalizeAdminPathname(pathname: string): string {
  return mapLegacyAdminToPublic(pathname);
}

/** 对外页面路径，如 adminPath()、adminPath("/login")、adminPath("/posts") */
export function adminPath(suffix = ""): string {
  const prefix = getAdminPathPrefix();
  const s = suffix ? (suffix.startsWith("/") ? suffix : `/${suffix}`) : "";
  if (!s || s === "/") return prefix;
  return `${prefix}${s}`;
}

/** 对外 API 路径，如 adminApiPath("media") → {prefix}/api/media */
export function adminApiPath(suffix = ""): string {
  const prefix = getAdminPathPrefix();
  const part = suffix ? (suffix.startsWith("/") ? suffix.slice(1) : suffix) : "";
  if (prefix === INTERNAL_ADMIN) {
    return part ? `/api/admin/${part}` : "/api/admin";
  }
  return part ? `${prefix}/api/${part}` : `${prefix}/api`;
}

export function matchesAdminRoute(pathname: string, suffix = ""): boolean {
  const p = normalizeAdminPathname(pathname);
  const target = adminPath(suffix);
  if (!suffix) return p === target;
  return p === target || p.startsWith(`${target}/`);
}

/** 生产环境是否仍直接访问 /admin 或 /api/admin */
export function isLegacyAdminRequest(pathname: string): boolean {
  if (!isAdminObfuscated()) return false;
  return (
    pathname === INTERNAL_ADMIN ||
    pathname.startsWith(`${INTERNAL_ADMIN}/`) ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/")
  );
}

/** 是否为后台相关请求（含对外隐蔽路径），用于跳过访问统计 */
export function isAdminAreaRequest(pathname: string): boolean {
  if (pathname === INTERNAL_ADMIN || pathname.startsWith(`${INTERNAL_ADMIN}/`)) return true;
  if (pathname === "/api/admin" || pathname.startsWith("/api/admin/")) return true;
  const prefix = getAdminPathPrefix();
  if (prefix !== INTERNAL_ADMIN) {
    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  }
  return false;
}

/** middleware：将对外路径 rewrite 为内部 /admin、/api/admin */
export function mapToInternalAdminPath(pathname: string): string | null {
  const prefix = getAdminPathPrefix();
  if (prefix === INTERNAL_ADMIN) return null;
  if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) return null;
  const rest = pathname.slice(prefix.length) || "/";
  if (rest.startsWith("/api/")) {
    const apiRest = rest.slice(4) || "";
    return apiRest ? `/api/admin/${apiRest}` : "/api/admin";
  }
  if (rest === "/") return INTERNAL_ADMIN;
  return `${INTERNAL_ADMIN}${rest}`;
}

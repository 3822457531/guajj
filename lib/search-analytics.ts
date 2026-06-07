import { cookies, headers } from "next/headers";
import { isDocumentNavigation, readSocialUserIdFromCookieHeader } from "@/lib/analytics";
import { readGuestUserIdFromCookieHeader } from "@/lib/guest-auth";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { SearchSource } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

const MAX_KEYWORD_LEN = 191;
const MAX_TEXT_LEN = 512;

export { SearchSource };

export type RecordSearchLogInput = {
  source: SearchSource;
  keyword: string;
  visitorId: string;
  ip: string;
  socialUserId?: string | null;
  guestUserId?: string | null;
  resultCount: number;
  userAgent?: string | null;
};

export type SearchStatsSlice = {
  todayCount: number;
  weekCount: number;
  totalCount: number;
  todayTop: Array<{ keyword: string; count: number }>;
  weekTop: Array<{ keyword: string; count: number }>;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export function normalizeSearchKeyword(keyword: string): string | null {
  const trimmed = keyword.trim();
  if (!trimmed) return null;
  return trimmed.length <= MAX_KEYWORD_LEN ? trimmed : trimmed.slice(0, MAX_KEYWORD_LEN);
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function sourceWhere(source: SearchSource) {
  return { source };
}

export async function recordSearchLog(input: RecordSearchLogInput) {
  const keyword = normalizeSearchKeyword(input.keyword);
  if (!keyword) return;

  await prisma.searchLog.create({
    data: {
      source: input.source,
      keyword,
      visitorId: truncate(input.visitorId, 64) ?? "unknown",
      ip: truncate(input.ip, 45) ?? "unknown",
      socialUserId: input.socialUserId ?? null,
      guestUserId: input.guestUserId ?? null,
      resultCount: Math.max(0, input.resultCount),
      userAgent: truncate(input.userAgent, MAX_TEXT_LEN)
    }
  });
}

/** 服务端页面在带 q 的 GET 请求时写入搜索明细 */
export async function recordSearchLogFromServer(source: SearchSource, keyword: string, resultCount: number) {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
  if (!isDocumentNavigation(hdrs)) return;
  const visitorId = cookieStore.get("cg_vid")?.value?.trim() || "unknown";
  const cookieHeader = hdrs.get("cookie") ?? "";

  await recordSearchLog({
    source,
    keyword,
    visitorId,
    ip: getClientIpFromHeaders(hdrs),
    socialUserId: readSocialUserIdFromCookieHeader(cookieHeader),
    guestUserId: readGuestUserIdFromCookieHeader(cookieHeader),
    resultCount,
    userAgent: hdrs.get("user-agent")
  });
}

/** API（如全网搜索 POST）写入搜索明细 */
export async function recordSearchLogFromRequest(
  request: Request,
  source: SearchSource,
  keyword: string,
  resultCount: number
) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const visitorId =
    cookieHeader
      .split(";")
      .map((p) => p.trim())
      .find((p) => p.startsWith("cg_vid="))
      ?.slice("cg_vid=".length)
      .trim() || "unknown";

  await recordSearchLog({
    source,
    keyword,
    visitorId,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    socialUserId: readSocialUserIdFromCookieHeader(cookieHeader),
    guestUserId: readGuestUserIdFromCookieHeader(cookieHeader),
    resultCount,
    userAgent: request.headers.get("user-agent")
  });
}

export async function getTopSearchKeywords(source: SearchSource, since: Date, limit = 15) {
  const grouped = await prisma.searchLog.groupBy({
    by: ["keyword"],
    where: { ...sourceWhere(source), createdAt: { gte: since } },
    _count: { keyword: true },
    orderBy: { _count: { keyword: "desc" } },
    take: limit
  });

  return grouped.map((row) => ({ keyword: row.keyword, count: row._count.keyword }));
}

export async function getRecentSearchLogs(source: SearchSource, limit = 100) {
  return prisma.searchLog.findMany({
    where: sourceWhere(source),
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      socialUser: { select: { id: true, nickname: true, loginType: true } },
      guestUser: { select: { id: true, publicId: true } }
    }
  });
}

export async function getSearchStatsForSource(source: SearchSource): Promise<SearchStatsSlice> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const base = sourceWhere(source);

  const [todayCount, weekCount, totalCount, todayTop, weekTop] = await Promise.all([
    prisma.searchLog.count({ where: { ...base, createdAt: { gte: todayStart } } }),
    prisma.searchLog.count({ where: { ...base, createdAt: { gte: weekStart } } }),
    prisma.searchLog.count({ where: base }),
    getTopSearchKeywords(source, todayStart, 15),
    getTopSearchKeywords(source, weekStart, 15)
  ]);

  return { todayCount, weekCount, totalCount, todayTop, weekTop };
}

export async function getSearchStatsOverview() {
  const [home, vip, global] = await Promise.all([
    getSearchStatsForSource(SearchSource.HOME),
    getSearchStatsForSource(SearchSource.VIP),
    getSearchStatsForSource(SearchSource.GLOBAL)
  ]);
  return { home, vip, global };
}

export async function getGuestGlobalSearchHistory(guestUserId: string, limit = 30) {
  return prisma.searchLog.findMany({
    where: { guestUserId, source: SearchSource.GLOBAL, userHiddenAt: null },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      keyword: true,
      resultCount: true,
      createdAt: true
    }
  });
}

/** 全网搜索历史：按关键词去重（淘宝式标签），优先使用缓存更新时间 */
export async function getGuestGlobalSearchHistoryKeywords(guestUserId: string, limit = 30) {
  const [cacheRows, logGrouped] = await Promise.all([
    prisma.globalSearchCache.findMany({
      where: { guestUserId, userHiddenAt: null },
      select: { keyword: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: limit
    }),
    prisma.searchLog.groupBy({
      by: ["keyword"],
      where: {
        guestUserId,
        source: SearchSource.GLOBAL,
        userHiddenAt: null
      },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: "desc" } },
      take: limit
    })
  ]);

  const merged = new Map<string, Date>();
  for (const row of cacheRows) {
    merged.set(row.keyword, row.updatedAt);
  }
  for (const row of logGrouped) {
    const logDate = row._max.createdAt;
    if (!logDate) continue;
    const existing = merged.get(row.keyword);
    if (!existing || logDate > existing) {
      merged.set(row.keyword, logDate);
    }
  }

  return Array.from(merged.entries())
    .sort((a, b) => b[1].getTime() - a[1].getTime())
    .slice(0, limit)
    .map(([keyword, searchedAt]) => ({ keyword, searchedAt }));
}

/** 用户端清除搜索记录（软删除，不影响管理员统计） */
export async function hideGuestGlobalSearchHistory(
  guestUserId: string,
  options: { all?: boolean; keyword?: string }
) {
  const keyword = options.keyword?.trim();
  if (!options.all && !keyword) return;

  const { hideGuestGlobalSearchCache } = await import("@/lib/global-search-cache");

  await Promise.all([
    prisma.searchLog.updateMany({
      where: {
        guestUserId,
        source: SearchSource.GLOBAL,
        userHiddenAt: null,
        ...(keyword ? { keyword: normalizeSearchKeyword(keyword) ?? keyword } : {})
      },
      data: { userHiddenAt: new Date() }
    }),
    hideGuestGlobalSearchCache(guestUserId, options)
  ]);
}

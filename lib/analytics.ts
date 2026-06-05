import { readSocialUserSessionToken } from "@/lib/social-auth";
import { prisma } from "@/lib/prisma";

const MAX_PATH_LEN = 191;
const MAX_TEXT_LEN = 512;

export type RecordPageVisitInput = {
  path: string;
  visitorId: string;
  ip: string;
  socialUserId?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function normalizePath(path: string): string {
  const raw = path.trim() || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const noQuery = withSlash.split("?")[0]?.split("#")[0] ?? withSlash;
  if (noQuery.length <= MAX_PATH_LEN) return noQuery;
  return noQuery.slice(0, MAX_PATH_LEN);
}

export function parsePostIdFromPath(path: string): string | null {
  const match = /^\/post\/([^/]+)/.exec(path);
  return match?.[1] ?? null;
}

export {
  analyticsInternalSecret,
  isDocumentNavigation,
  isPrefetchLikeRequest,
  shouldTrackPageVisit
} from "@/lib/analytics-edge";

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function endOfDay(d: Date): Date {
  const start = startOfDay(d);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function readSocialUserIdFromCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const match = /(?:^|;\s*)cg_social_user=([^;]+)/.exec(cookieHeader);
  if (!match?.[1]) return null;
  const session = readSocialUserSessionToken(decodeURIComponent(match[1]));
  return session?.socialUserId ?? null;
}

export async function recordPageVisit(input: RecordPageVisitInput) {
  const path = normalizePath(input.path);
  const postId = parsePostIdFromPath(path);
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);

  const isNewVisitorToday = !(await prisma.pageVisit.findFirst({
    where: {
      visitorId: input.visitorId,
      createdAt: { gte: dayStart, lt: dayEnd }
    },
    select: { id: true }
  }));

  await prisma.$transaction([
    prisma.pageVisit.create({
      data: {
        path,
        postId,
        visitorId: input.visitorId,
        ip: truncate(input.ip, 45) ?? "unknown",
        socialUserId: input.socialUserId ?? null,
        userAgent: truncate(input.userAgent, MAX_TEXT_LEN),
        referrer: truncate(input.referrer, MAX_TEXT_LEN)
      }
    }),
    prisma.dailySiteStat.upsert({
      where: { date: dayStart },
      create: {
        date: dayStart,
        pageViews: 1,
        uniqueVisitors: isNewVisitorToday ? 1 : 0,
        loggedInPageViews: input.socialUserId ? 1 : 0
      },
      update: {
        pageViews: { increment: 1 },
        uniqueVisitors: isNewVisitorToday ? { increment: 1 } : undefined,
        loggedInPageViews: input.socialUserId ? { increment: 1 } : undefined
      }
    })
  ]);
}

function sumStats(rows: Array<{ pageViews: number; uniqueVisitors: number; loggedInPageViews: number }>) {
  return rows.reduce(
    (acc, row) => ({
      pageViews: acc.pageViews + row.pageViews,
      uniqueVisitors: acc.uniqueVisitors + row.uniqueVisitors,
      loggedInPageViews: acc.loggedInPageViews + row.loggedInPageViews
    }),
    { pageViews: 0, uniqueVisitors: 0, loggedInPageViews: 0 }
  );
}

export async function getAnalyticsOverview() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [todayRow, yesterdayRow, weekRows, activeLoggedInUsers] = await Promise.all([
    prisma.dailySiteStat.findUnique({ where: { date: todayStart } }),
    prisma.dailySiteStat.findUnique({ where: { date: yesterdayStart } }),
    prisma.dailySiteStat.findMany({
      where: { date: { gte: weekStart, lte: todayStart } },
      orderBy: { date: "asc" }
    }),
    prisma.pageVisit.groupBy({
      by: ["socialUserId"],
      where: {
        socialUserId: { not: null },
        createdAt: { gte: weekStart }
      },
      _count: { socialUserId: true }
    })
  ]);

  const today = todayRow ?? { pageViews: 0, uniqueVisitors: 0, loggedInPageViews: 0 };
  const yesterday = yesterdayRow ?? { pageViews: 0, uniqueVisitors: 0, loggedInPageViews: 0 };
  const week = sumStats(weekRows);

  return {
    today,
    yesterday,
    week,
    activeLoggedInUsers: activeLoggedInUsers.length
  };
}

export async function getDailyTrend(days = 14) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const start = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  const rows = await prisma.dailySiteStat.findMany({
    where: { date: { gte: start, lte: todayStart } },
    orderBy: { date: "asc" }
  });

  const byDate = new Map(rows.map((row) => [row.date.toISOString().slice(0, 10), row]));
  const result: Array<{
    date: string;
    pageViews: number;
    uniqueVisitors: number;
    loggedInPageViews: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    result.push({
      date: key,
      pageViews: row?.pageViews ?? 0,
      uniqueVisitors: row?.uniqueVisitors ?? 0,
      loggedInPageViews: row?.loggedInPageViews ?? 0
    });
  }

  return result;
}

export async function getTopPaths(limit = 10) {
  const weekStart = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const grouped = await prisma.pageVisit.groupBy({
    by: ["path"],
    where: { createdAt: { gte: weekStart } },
    _count: { path: true },
    orderBy: { _count: { path: "desc" } },
    take: limit
  });

  return grouped.map((row) => ({ path: row.path, count: row._count.path }));
}

export async function getRecentVisits(limit = 50) {
  return prisma.pageVisit.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      socialUser: { select: { id: true, nickname: true, loginType: true } }
    }
  });
}

export async function getSocialUserVisitCounts(socialUserIds: string[], days = 7) {
  if (socialUserIds.length === 0) return new Map<string, number>();

  const since = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const grouped = await prisma.pageVisit.groupBy({
    by: ["socialUserId"],
    where: {
      socialUserId: { in: socialUserIds },
      createdAt: { gte: since }
    },
    _count: { socialUserId: true }
  });

  return new Map(
    grouped
      .filter((row): row is typeof row & { socialUserId: string } => Boolean(row.socialUserId))
      .map((row) => [row.socialUserId, row._count.socialUserId])
  );
}


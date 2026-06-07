import { getGuestSessionPayload } from "@/lib/guest-auth";
import { findGuestById } from "@/lib/guest-user";
import { SearchSource } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export type SearchQuotaStatus = {
  guestUserId: string | null;
  publicId: string | null;
  used: number;
  limit: number;
  remaining: number;
  searchBonus: number;
  hasIdentity: boolean;
  exceeded: boolean;
  /** 高级搜索 / 首页索引搜索为 true */
  unlimited?: boolean;
};

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function countTodaySearchesForGuest(guestUserId: string, source?: SearchSource) {
  return prisma.searchLog.count({
    where: {
      guestUserId,
      ...(source ? { source } : {}),
      createdAt: { gte: startOfDayUtc(new Date()) }
    }
  });
}

async function loadGuestQuotaBase(guestUserId: string | null) {
  if (!guestUserId) {
    return { guest: null, usedGlobal: 0 };
  }

  const [guest, usedGlobal] = await Promise.all([
    findGuestById(guestUserId),
    countTodaySearchesForGuest(guestUserId, SearchSource.GLOBAL)
  ]);

  return { guest, usedGlobal };
}

/** 全网搜索（暗网索引）每日配额 */
export async function getGuestGlobalSearchQuota(guestUserId: string | null): Promise<SearchQuotaStatus> {
  const settings = await getSiteSettings();
  const baseLimit = Math.max(0, settings.globalDailySearchLimit ?? 5);
  const { guest, usedGlobal } = await loadGuestQuotaBase(guestUserId);

  if (!guest) {
    return {
      guestUserId: null,
      publicId: null,
      used: 0,
      limit: baseLimit,
      remaining: 0,
      searchBonus: 0,
      hasIdentity: false,
      exceeded: true
    };
  }

  const limit = baseLimit + Math.max(0, guest.searchBonus);
  const remaining = Math.max(0, limit - usedGlobal);

  return {
    guestUserId: guest.id,
    publicId: guest.publicId,
    used: usedGlobal,
    limit,
    remaining,
    searchBonus: guest.searchBonus,
    hasIdentity: true,
    exceeded: usedGlobal >= limit
  };
}

export async function getCurrentGuestGlobalSearchQuota() {
  const session = await getGuestSessionPayload();
  return getGuestGlobalSearchQuota(session?.guestUserId ?? null);
}

export async function assertGlobalSearchAllowed(): Promise<
  { allowed: true; quota: SearchQuotaStatus } | { allowed: false; quota: SearchQuotaStatus }
> {
  const quota = await getCurrentGuestGlobalSearchQuota();
  if (!quota.hasIdentity || quota.exceeded) {
    return { allowed: false, quota };
  }
  return { allowed: true, quota };
}

/** 高级搜索 / 首页搜索：仅需 GUA 身份，不限次数 */
export async function assertAdvancedSearchIdentity(): Promise<
  { allowed: true; quota: SearchQuotaStatus } | { allowed: false; quota: SearchQuotaStatus }
> {
  const quota = await getCurrentGuestGlobalSearchQuota();
  if (!quota.hasIdentity) {
    return { allowed: false, quota: { ...quota, unlimited: true } };
  }
  return {
    allowed: true,
    quota: {
      ...quota,
      used: 0,
      limit: 0,
      remaining: Number.MAX_SAFE_INTEGER,
      exceeded: false,
      unlimited: true
    }
  };
}

/** @deprecated 请用 assertGlobalSearchAllowed 或 assertAdvancedSearchIdentity */
export async function getCurrentGuestSearchQuota() {
  return getCurrentGuestGlobalSearchQuota();
}

/** @deprecated VIP/首页已不限次，仅保留兼容 */
export async function assertSearchAllowed() {
  return assertAdvancedSearchIdentity();
}

export async function getGuestSearchQuota(guestUserId: string | null) {
  return getGuestGlobalSearchQuota(guestUserId);
}

export { SearchSource };

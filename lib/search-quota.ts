import { getGuestSessionPayload } from "@/lib/guest-auth";
import { findGuestById } from "@/lib/guest-user";
import { SearchSource } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";

export type SearchQuotaStatus = {
  guestUserId: string | null;
  publicId: string | null;
  /** 已消耗 = 累计获得 − 当前余额 */
  used: number;
  /** 累计获得的永久瓜皮 */
  limit: number;
  /** 当前可用余额 */
  remaining: number;
  /** 同 limit：累计获得 */
  searchBonus: number;
  hasIdentity: boolean;
  exceeded: boolean;
  /** 今日是否已签到 */
  checkedInToday?: boolean;
  /** 高级搜索 / 首页索引搜索为 true */
  unlimited?: boolean;
};

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isSameUtcDay(a: Date | null | undefined, b: Date = new Date()): boolean {
  if (!a) return false;
  return startOfDayUtc(a).getTime() === startOfDayUtc(b).getTime();
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

/** @deprecated 永久瓜皮不再按日统计消耗；保留兼容旧调用 */
export async function countTodayGuapiUsedForGuest(guestUserId: string) {
  const todayStart = startOfDayUtc(new Date());
  const agg = await prisma.smsGuapiLog.aggregate({
    where: {
      guestUserId,
      createdAt: { gte: todayStart },
      amount: { lt: 0 }
    },
    _sum: { amount: true }
  });
  return Math.abs(agg._sum.amount ?? 0);
}

/** 永久瓜皮：剩余 = guapiBalance，累计获得 = searchBonus */
export async function getGuestGlobalSearchQuota(guestUserId: string | null): Promise<SearchQuotaStatus> {
  if (!guestUserId) {
    return {
      guestUserId: null,
      publicId: null,
      used: 0,
      limit: 0,
      remaining: 0,
      searchBonus: 0,
      hasIdentity: false,
      exceeded: true,
      checkedInToday: false
    };
  }

  const guest = await findGuestById(guestUserId);
  if (!guest) {
    return {
      guestUserId: null,
      publicId: null,
      used: 0,
      limit: 0,
      remaining: 0,
      searchBonus: 0,
      hasIdentity: false,
      exceeded: true,
      checkedInToday: false
    };
  }

  const earned = Math.max(0, guest.searchBonus);
  const remaining = Math.max(0, guest.guapiBalance);
  const used = Math.max(0, earned - remaining);

  return {
    guestUserId: guest.id,
    publicId: guest.publicId,
    used,
    limit: earned,
    remaining,
    searchBonus: earned,
    hasIdentity: true,
    exceeded: remaining <= 0,
    checkedInToday: isSameUtcDay(guest.lastCheckInAt)
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

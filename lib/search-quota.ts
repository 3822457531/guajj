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
};

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getGuestSearchQuota(guestUserId: string | null): Promise<SearchQuotaStatus> {
  const settings = await getSiteSettings();
  const baseLimit = Math.max(0, settings.dailySearchLimit);

  if (!guestUserId) {
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

  const [guest, used] = await Promise.all([
    findGuestById(guestUserId),
    prisma.searchLog.count({
      where: {
        guestUserId,
        createdAt: { gte: startOfDayUtc(new Date()) }
      }
    })
  ]);

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
  const remaining = Math.max(0, limit - used);

  return {
    guestUserId: guest.id,
    publicId: guest.publicId,
    used,
    limit,
    remaining,
    searchBonus: guest.searchBonus,
    hasIdentity: true,
    exceeded: used >= limit
  };
}

export async function getCurrentGuestSearchQuota(): Promise<SearchQuotaStatus> {
  const session = await getGuestSessionPayload();
  return getGuestSearchQuota(session?.guestUserId ?? null);
}

export async function assertSearchAllowed(): Promise<{ allowed: true; quota: SearchQuotaStatus } | { allowed: false; quota: SearchQuotaStatus }> {
  const quota = await getCurrentGuestSearchQuota();
  if (!quota.hasIdentity || quota.exceeded) {
    return { allowed: false, quota };
  }
  return { allowed: true, quota };
}

export async function countTodaySearchesForGuest(guestUserId: string) {
  return prisma.searchLog.count({
    where: {
      guestUserId,
      createdAt: { gte: startOfDayUtc(new Date()) }
    }
  });
}

export { SearchSource };

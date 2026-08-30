import { prisma } from "@/lib/prisma";
import { SearchSource } from "@/lib/generated/prisma";
import { getGuestGlobalSearchQuota, isSameUtcDay } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";

export const INSUFFICIENT_GUAPI_CODE = "INSUFFICIENT_GUAPI";

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** 今日接码已消耗瓜皮（取绝对值求和） */
export async function countTodaySmsGuapiUsed(guestUserId: string): Promise<number> {
  const agg = await prisma.smsGuapiLog.aggregate({
    where: {
      guestUserId,
      createdAt: { gte: startOfDayUtc(new Date()) },
      amount: { lt: 0 }
    },
    _sum: { amount: true }
  });
  return Math.abs(agg._sum.amount ?? 0);
}

/** 永久瓜皮剩余额度 */
export async function getGuestGuapiRemaining(guestUserId: string) {
  const quota = await getGuestGlobalSearchQuota(guestUserId);
  return {
    remaining: quota.remaining,
    limit: quota.limit,
    used: quota.used,
    searchBonus: quota.searchBonus
  };
}

export async function assertGuestGuapiAvailable(guestUserId: string, cost: number) {
  const normalized = Math.max(0, Math.round(cost));
  const quota = await getGuestGlobalSearchQuota(guestUserId);
  if (quota.remaining < normalized) {
    return {
      ok: false as const,
      balance: quota.remaining,
      required: normalized,
      limit: quota.limit
    };
  }
  return { ok: true as const, quota };
}

export async function deductGuestGuapi(
  guestUserId: string,
  amount: number,
  type: string,
  description?: string
) {
  const cost = Math.max(0, Math.round(amount));
  if (cost <= 0) return;

  const result = await prisma.$transaction(async (tx) => {
    const guest = await tx.guestUser.findUnique({
      where: { id: guestUserId },
      select: { guapiBalance: true }
    });
    if (!guest || guest.guapiBalance < cost) {
      return { ok: false as const, balance: guest?.guapiBalance ?? 0 };
    }

    await tx.guestUser.update({
      where: { id: guestUserId },
      data: { guapiBalance: { decrement: cost } }
    });
    await tx.smsGuapiLog.create({
      data: {
        guestUserId,
        amount: -cost,
        type,
        description: description ?? null
      }
    });
    return { ok: true as const };
  });

  if (!result.ok) {
    const err = new Error("瓜皮不足");
    (err as Error & { code?: string; balance?: number; required?: number }).code =
      INSUFFICIENT_GUAPI_CODE;
    (err as Error & { balance?: number }).balance = result.balance;
    (err as Error & { required?: number }).required = cost;
    throw err;
  }
}

/**
 * 增加永久瓜皮：同时累加「累计获得 searchBonus」与「可用余额 guapiBalance」
 * type: register | check_in | referral | purchase | recharge | ...
 */
export async function addGuestGuapi(
  guestUserId: string,
  amount: number,
  type: string,
  description?: string
) {
  const delta = Math.max(0, Math.round(amount));
  if (delta <= 0) return;

  await prisma.$transaction([
    prisma.guestUser.update({
      where: { id: guestUserId },
      data: {
        searchBonus: { increment: delta },
        guapiBalance: { increment: delta }
      }
    }),
    prisma.smsGuapiLog.create({
      data: {
        guestUserId,
        amount: delta,
        type,
        description: description ?? null
      }
    })
  ]);
}

export type CheckInResult =
  | {
      ok: true;
      granted: number;
      alreadyCheckedIn: false;
      quota: Awaited<ReturnType<typeof getGuestGlobalSearchQuota>>;
    }
  | {
      ok: true;
      granted: 0;
      alreadyCheckedIn: true;
      quota: Awaited<ReturnType<typeof getGuestGlobalSearchQuota>>;
    };

/** 每日签到：按 UTC 自然日仅一次，增加 checkInGuapiGift 永久瓜皮 */
export async function checkInGuestGuapi(guestUserId: string): Promise<CheckInResult> {
  const settings = await getSiteSettings();
  const gift = Math.max(0, settings.checkInGuapiGift ?? 1);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const guest = await tx.guestUser.findUnique({
      where: { id: guestUserId },
      select: { lastCheckInAt: true }
    });
    if (!guest) {
      throw new Error("guest_not_found");
    }
    if (isSameUtcDay(guest.lastCheckInAt, now)) {
      return { already: true as const };
    }

    if (gift > 0) {
      await tx.guestUser.update({
        where: { id: guestUserId },
        data: {
          lastCheckInAt: now,
          searchBonus: { increment: gift },
          guapiBalance: { increment: gift }
        }
      });
      await tx.smsGuapiLog.create({
        data: {
          guestUserId,
          amount: gift,
          type: "check_in",
          description: `每日签到 +${gift}`
        }
      });
    } else {
      await tx.guestUser.update({
        where: { id: guestUserId },
        data: { lastCheckInAt: now }
      });
    }

    return { already: false as const, granted: gift };
  });

  const quota = await getGuestGlobalSearchQuota(guestUserId);
  if (result.already) {
    return { ok: true, granted: 0, alreadyCheckedIn: true, quota };
  }
  return { ok: true, granted: result.granted, alreadyCheckedIn: false, quota };
}

export async function logSmsAction(input: {
  guestUserId?: string | null;
  action: string;
  phone?: string | null;
  keyword?: string | null;
  message?: string | null;
  rawResponse?: unknown;
}) {
  await prisma.smsLog.create({
    data: {
      guestUserId: input.guestUserId ?? null,
      action: input.action,
      phone: input.phone ?? null,
      keyword: input.keyword ?? null,
      message: input.message ?? null,
      rawResponse: input.rawResponse ? JSON.stringify(input.rawResponse) : null
    }
  });
}

/** @deprecated 使用 getGuestGuapiRemaining */
export async function getGuestGuapiBalance(guestUserId: string): Promise<number> {
  const q = await getGuestGuapiRemaining(guestUserId);
  return q.remaining;
}

export { SearchSource };

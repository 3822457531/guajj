import { prisma } from "@/lib/prisma";
import { SearchSource } from "@/lib/generated/prisma";
import { getGuestGlobalSearchQuota } from "@/lib/search-quota";

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

/** 与搜索共用「今日瓜皮」剩余额度 */
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

  const check = await assertGuestGuapiAvailable(guestUserId, cost);
  if (!check.ok) {
    const err = new Error("瓜皮不足");
    (err as Error & { code?: string; balance?: number; required?: number }).code =
      INSUFFICIENT_GUAPI_CODE;
    (err as Error & { balance?: number }).balance = check.balance;
    (err as Error & { required?: number }).required = check.required;
    throw err;
  }

  await prisma.smsGuapiLog.create({
    data: {
      guestUserId,
      amount: -cost,
      type,
      description: description ?? null
    }
  });
}

/** 管理员充值：增加永久瓜皮（与邀请奖励同一字段） */
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
      data: { searchBonus: { increment: delta } }
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

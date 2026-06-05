import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSiteSettings } from "@/lib/site-settings";

const PUBLIC_ID_PREFIX = "GUA-";
const PUBLIC_ID_RE = /^GUA-\d{6}$/;

function randomSegment(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: len }, () => chars[crypto.randomInt(chars.length)]).join("");
}

export function generatePublicId() {
  const num = crypto.randomInt(100000, 1000000);
  return `${PUBLIC_ID_PREFIX}${num}`;
}

export function generateSecretKey() {
  return `sk_${randomSegment(4)}_${randomSegment(4)}_${randomSegment(4)}_m${randomSegment(1)}p`;
}

export function isValidPublicId(value: string) {
  return PUBLIC_ID_RE.test(value.trim());
}

async function uniquePublicId() {
  for (let i = 0; i < 12; i++) {
    const publicId = generatePublicId();
    const exists = await prisma.guestUser.findUnique({ where: { publicId }, select: { id: true } });
    if (!exists) return publicId;
  }
  throw new Error("无法生成唯一身份 ID");
}

export async function findGuestByPublicId(publicId: string) {
  const trimmed = publicId.trim();
  if (!isValidPublicId(trimmed)) return null;
  return prisma.guestUser.findUnique({ where: { publicId: trimmed } });
}

export async function findGuestById(id: string) {
  return prisma.guestUser.findUnique({
    where: { id },
    include: { referrer: { select: { publicId: true } } }
  });
}

export type CreateGuestUserResult = {
  id: string;
  publicId: string;
  secretKey: string;
  referrerPublicId: string | null;
};

export async function createGuestUser(
  referrerPublicId?: string | null,
  registerIp?: string | null
): Promise<CreateGuestUserResult> {
  const publicId = await uniquePublicId();
  const secretKey = generateSecretKey();
  const secretKeyHash = hashPassword(secretKey);
  const ip = truncateIp(registerIp);
  const now = new Date();

  let referrerId: string | null = null;
  let referrerPublicIdResolved: string | null = null;

  if (referrerPublicId && isValidPublicId(referrerPublicId)) {
    const referrer = await findGuestByPublicId(referrerPublicId);
    if (referrer) {
      referrerId = referrer.id;
      referrerPublicIdResolved = referrer.publicId;
    }
  }

  const settings = await getSiteSettings();
  const bonus = Math.max(0, settings.referralSearchBonus);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.guestUser.create({
      data: {
        publicId,
        secretKeyHash,
        registerIp: ip,
        lastLoginIp: ip,
        lastLoginAt: now,
        ...(referrerId ? { referrer: { connect: { id: referrerId } } } : {})
      }
    });

    if (referrerId && bonus > 0) {
      await tx.guestUser.update({
        where: { id: referrerId },
        data: { searchBonus: { increment: bonus } }
      });
    }

    return created;
  });

  return {
    id: user.id,
    publicId: user.publicId,
    secretKey,
    referrerPublicId: referrerPublicIdResolved
  };
}

function truncateIp(ip: string | null | undefined) {
  const trimmed = ip?.trim();
  if (!trimmed) return null;
  return trimmed.length <= 45 ? trimmed : trimmed.slice(0, 45);
}

/** 记录匿名用户最近一次登录（注册、恢复会话、有效 Cookie 访问） */
export async function touchGuestLogin(guestUserId: string, ip?: string | null) {
  await prisma.guestUser.update({
    where: { id: guestUserId },
    data: {
      lastLoginAt: new Date(),
      ...(ip ? { lastLoginIp: truncateIp(ip) } : {})
    }
  });
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getGuestUserStatsOverview() {
  const todayStart = startOfDayUtc(new Date());
  const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const [total, todayNew, yesterdayNew, weekNew] = await Promise.all([
    prisma.guestUser.count(),
    prisma.guestUser.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.guestUser.count({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } }
    }),
    prisma.guestUser.count({ where: { createdAt: { gte: weekStart } } })
  ]);

  return { total, todayNew, yesterdayNew, weekNew };
}

export async function verifyGuestSecret(publicId: string, secretKey: string) {
  const user = await findGuestByPublicId(publicId);
  if (!user) return null;
  if (!verifyPassword(secretKey, user.secretKeyHash)) return null;
  return user;
}

export async function countGuestReferrals(guestUserId: string) {
  return prisma.guestUser.count({ where: { referrerId: guestUserId } });
}

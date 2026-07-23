import { deductGuestGuapi, INSUFFICIENT_GUAPI_CODE } from "@/lib/sms-guapi";
import { getGuestGlobalSearchQuota } from "@/lib/search-quota";
import { prisma } from "@/lib/prisma";

export type ContentViewInput = {
  username: string;
  messageId: number;
  title?: string | null;
  label?: string | null;
  searchQuery?: string | null;
};

export type ContentViewResult = {
  billed: boolean;
  alreadyViewed: boolean;
};

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

export async function hasGuestViewedContent(
  guestUserId: string,
  username: string,
  messageId: number
): Promise<boolean> {
  const row = await prisma.contentViewLog.findUnique({
    where: {
      guestUserId_username_messageId: { guestUserId, username, messageId }
    },
    select: { id: true }
  });
  return Boolean(row);
}

/** 观看资源：首次扣 1 瓜皮，重复观看同一资源不扣 */
export async function recordContentView(
  guestUserId: string,
  input: ContentViewInput
): Promise<ContentViewResult> {
  const username = input.username.trim();
  const messageId = input.messageId;
  if (!username || messageId <= 0) {
    throw new Error("invalid_content");
  }

  const existing = await prisma.contentViewLog.findUnique({
    where: {
      guestUserId_username_messageId: { guestUserId, username, messageId }
    }
  });

  if (existing) {
    await prisma.contentViewLog.update({
      where: { id: existing.id },
      data: {
        title: truncate(input.title, 500) ?? existing.title,
        label: truncate(input.label, 255) ?? existing.label,
        searchQuery: truncate(input.searchQuery, 191) ?? existing.searchQuery,
        updatedAt: new Date()
      }
    });
    return { billed: false, alreadyViewed: true };
  }

  try {
    await deductGuestGuapi(
      guestUserId,
      1,
      "consume_view",
      `${username}/${messageId}`
    );
  } catch (err) {
    if ((err as Error & { code?: string }).code === INSUFFICIENT_GUAPI_CODE) {
      throw err;
    }
    throw err;
  }

  await prisma.contentViewLog.create({
    data: {
      guestUserId,
      username,
      messageId,
      title: truncate(input.title, 500),
      label: truncate(input.label, 255),
      searchQuery: truncate(input.searchQuery, 191)
    }
  });

  return { billed: true, alreadyViewed: false };
}

export async function getGuestViewHistory(guestUserId: string, limit = 30) {
  return prisma.contentViewLog.findMany({
    where: { guestUserId, userHiddenAt: null },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      username: true,
      messageId: true,
      title: true,
      label: true,
      searchQuery: true,
      updatedAt: true
    }
  });
}

export async function hideGuestViewHistory(
  guestUserId: string,
  options: { all?: boolean; id?: string }
) {
  if (!options.all && !options.id) return;

  await prisma.contentViewLog.updateMany({
    where: {
      guestUserId,
      userHiddenAt: null,
      ...(options.id ? { id: options.id } : {})
    },
    data: { userHiddenAt: new Date() }
  });
}

export async function assertViewAllowed(guestUserId: string | null) {
  const quota = await getGuestGlobalSearchQuota(guestUserId);
  if (!quota.hasIdentity) {
    return { allowed: false as const, quota };
  }
  if (quota.exceeded) {
    return { allowed: false as const, quota };
  }
  return { allowed: true as const, quota };
}

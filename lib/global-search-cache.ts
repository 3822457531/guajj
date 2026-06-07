import type { Prisma } from "@/lib/generated/prisma";
import type { JisouSearchResult } from "@/lib/jisou-search-types";
import { prisma } from "@/lib/prisma";
import { normalizeSearchKeyword } from "@/lib/search-analytics";

export type GlobalSearchCachePayload = Pick<
  JisouSearchResult,
  "query" | "replyMessageId" | "channels" | "hotKeywords" | "ads" | "buttons" | "fetchedAt"
>;

export type GlobalSearchCacheRow = {
  id: string;
  keyword: string;
  channelCount: number;
  payload: GlobalSearchCachePayload;
  sourceFetchedAt: Date | null;
  updatedAt: Date;
};

function parseFetchedAt(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getCachedGlobalSearch(
  guestUserId: string,
  keyword: string
): Promise<GlobalSearchCacheRow | null> {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return null;

  const row = await prisma.globalSearchCache.findUnique({
    where: {
      guestUserId_keyword: { guestUserId, keyword: normalized }
    }
  });

  if (!row || row.userHiddenAt) return null;

  return {
    id: row.id,
    keyword: row.keyword,
    channelCount: row.channelCount,
    payload: row.payload as GlobalSearchCachePayload,
    sourceFetchedAt: row.sourceFetchedAt,
    updatedAt: row.updatedAt
  };
}

export async function touchGlobalSearchCache(cacheId: string) {
  await prisma.globalSearchCache.update({
    where: { id: cacheId },
    data: { updatedAt: new Date() }
  });
}

export async function upsertGlobalSearchCache(
  guestUserId: string,
  keyword: string,
  result: JisouSearchResult
) {
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return;

  const channelCount = result.channels?.length ?? 0;
  if (channelCount <= 0) return;

  const payload: GlobalSearchCachePayload = {
    query: result.query,
    replyMessageId: result.replyMessageId,
    channels: result.channels,
    hotKeywords: result.hotKeywords ?? [],
    ads: result.ads ?? [],
    buttons: result.buttons,
    fetchedAt: result.fetchedAt
  };
  const payloadJson = JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;

  await prisma.globalSearchCache.upsert({
    where: {
      guestUserId_keyword: { guestUserId, keyword: normalized }
    },
    create: {
      guestUserId,
      keyword: normalized,
      channelCount,
      payload: payloadJson,
      sourceFetchedAt: parseFetchedAt(result.fetchedAt),
      userHiddenAt: null
    },
    update: {
      channelCount,
      payload: payloadJson,
      sourceFetchedAt: parseFetchedAt(result.fetchedAt),
      userHiddenAt: null,
      updatedAt: new Date()
    }
  });
}

export async function hideGuestGlobalSearchCache(
  guestUserId: string,
  options: { all?: boolean; keyword?: string }
) {
  const keyword = options.keyword?.trim();
  if (!options.all && !keyword) return;

  await prisma.globalSearchCache.updateMany({
    where: {
      guestUserId,
      userHiddenAt: null,
      ...(keyword ? { keyword: normalizeSearchKeyword(keyword) ?? keyword } : {})
    },
    data: { userHiddenAt: new Date() }
  });
}

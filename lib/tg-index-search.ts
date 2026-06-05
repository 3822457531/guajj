import { Prisma, TgIndexContentType } from "@/lib/generated/prisma";
import type { Prisma as PrismaTypes, TgIndexedMessage } from "@/lib/generated/prisma";
import {
  buildIndexedMessageBlockedExcludeWhere,
  getBlockedKeywords,
  indexedMessageIsBlocked,
  mergePrismaWhere
} from "@/lib/blocked-keywords";
import { prisma } from "@/lib/prisma";
import { buildIndexMessagesListWhere } from "@/lib/index-message-admin";
import { itemMatchesVipSearchTab, type VipSearchTab } from "@/lib/vip-result-display";

export const VIP_SEARCH_PAGE_SIZE = 15;

export type VipSearchResult = {
  items: TgIndexedMessage[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function isMysqlDatabase() {
  return (process.env.DATABASE_URL ?? "").startsWith("mysql");
}

/** 需库表已建 ngram FULLTEXT 索引；未建索引时保持关闭，避免 prisma:error 日志 */
function isMysqlFulltextSearchEnabled() {
  return process.env.VIP_SEARCH_FULLTEXT === "1";
}

function isMissingFulltextIndexError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === "P2010") {
    const meta = error.meta as { code?: string; message?: string } | undefined;
    return meta?.code === "1191" || String(meta?.message ?? "").includes("FULLTEXT");
  }
  return String(error.message).includes("FULLTEXT");
}

function buildTabWhere(tab: VipSearchTab): PrismaTypes.TgIndexedMessageWhereInput | undefined {
  switch (tab) {
    case "video":
      return {
        OR: [
          { contentType: TgIndexContentType.VIDEO },
          { galleryVideoUrls: { contains: "http" } },
          { mediaUrl: { contains: ".mp4" } },
          { mediaUrl: { contains: ".webm" } }
        ]
      };
    case "image":
      return {
        AND: [
          { contentType: { not: TgIndexContentType.VIDEO } },
          { OR: [{ galleryVideoUrls: null }, { galleryVideoUrls: "" }] },
          {
            OR: [
              { contentType: TgIndexContentType.PHOTO },
              { galleryImageUrls: { contains: "http" } },
              { mediaUrl: { contains: ".jpg" } },
              { mediaUrl: { contains: ".jpeg" } },
              { mediaUrl: { contains: ".png" } },
              { mediaUrl: { contains: ".webp" } },
              { mediaUrl: { contains: "/uploads/" } }
            ]
          }
        ]
      };
    case "news":
    case "post":
      return {
        contentType: TgIndexContentType.TEXT,
        mediaUrl: null,
        galleryImageUrls: null,
        galleryVideoUrls: null
      };
    default:
      return undefined;
  }
}

function buildSearchWhere(
  q: string,
  tab: VipSearchTab = "all",
  blocked: string[] = []
): PrismaTypes.TgIndexedMessageWhereInput {
  const trimmed = q.trim();
  const textWhere: PrismaTypes.TgIndexedMessageWhereInput = {
    OR: [
      { title: { contains: trimmed } },
      { snippet: { contains: trimmed } },
      { rawText: { contains: trimmed } },
      { sourceTitle: { contains: trimmed } },
      { sourceUsername: { contains: trimmed } }
    ]
  };
  const tabWhere = buildTabWhere(tab);
  const blockedWhere = buildIndexedMessageBlockedExcludeWhere(blocked);
  let where: PrismaTypes.TgIndexedMessageWhereInput = textWhere;
  if (tabWhere) where = { AND: [textWhere, tabWhere] };
  return mergePrismaWhere(where, blockedWhere) ?? where;
}

type IndexedMessageRow = {
  id: string;
  chatId: string;
  messageId: number;
  messageDate: Date;
  contentType: TgIndexedMessage["contentType"];
  title: string;
  snippet: string;
  rawText: string;
  sourceTitle: string | null;
  sourceUsername: string | null;
  durationSec: number | null;
  mediaUrl: string | null;
  galleryImageUrls: string | null;
  galleryVideoUrls: string | null;
  contentBlocks: string | null;
  mediaGroupId: string | null;
  createdAt: Date;
};

async function searchIndexedMessagesFulltext(
  trimmed: string,
  safePage: number,
  pageSize: number,
  tab: VipSearchTab
): Promise<VipSearchResult> {
  const offset = (safePage - 1) * pageSize;
  const like = `%${trimmed}%`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<IndexedMessageRow[]>`
      SELECT
        id, chatId, messageId, messageDate, contentType, title, snippet, rawText,
        sourceTitle, sourceUsername, durationSec, mediaUrl,
        galleryImageUrls, galleryVideoUrls, contentBlocks, mediaGroupId, createdAt
      FROM TgIndexedMessage
      WHERE MATCH(title, snippet, rawText) AGAINST (${trimmed} IN NATURAL LANGUAGE MODE)
         OR title LIKE ${like}
         OR snippet LIKE ${like}
         OR sourceTitle LIKE ${like}
      ORDER BY messageDate DESC, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `,
    prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(*) AS cnt
      FROM TgIndexedMessage
      WHERE MATCH(title, snippet, rawText) AGAINST (${trimmed} IN NATURAL LANGUAGE MODE)
         OR title LIKE ${like}
         OR snippet LIKE ${like}
         OR sourceTitle LIKE ${like}
    `
  ]);

  let items = rows as TgIndexedMessage[];
  if (tab !== "all") {
    items = items.filter((item) => itemMatchesVipSearchTab(item, tab));
  }

  const total = Number(countRows[0]?.cnt ?? 0);
  const totalPages = Math.max(0, Math.ceil(total / pageSize));
  const clampedPage = totalPages > 0 ? Math.min(safePage, totalPages) : 1;

  return {
    items,
    total,
    page: clampedPage,
    pageSize,
    totalPages
  };
}

async function searchIndexedMessagesContains(
  trimmed: string,
  safePage: number,
  pageSize: number,
  tab: VipSearchTab,
  blocked: string[]
): Promise<VipSearchResult> {
  const where = buildSearchWhere(trimmed, tab, blocked);
  const total = await prisma.tgIndexedMessage.count({ where });
  const totalPages = Math.max(0, Math.ceil(total / pageSize));
  const clampedPage = totalPages > 0 ? Math.min(safePage, totalPages) : 1;

  let items = await prisma.tgIndexedMessage.findMany({
    where,
    orderBy: [{ messageDate: "desc" }, { id: "desc" }],
    skip: (clampedPage - 1) * pageSize,
    take: pageSize
  });

  if (tab !== "all") {
    items = items.filter((item) => itemMatchesVipSearchTab(item, tab));
  }

  return {
    items,
    total,
    page: clampedPage,
    pageSize,
    totalPages
  };
}

export async function searchIndexedMessages(
  q: string,
  page: number,
  pageSize = VIP_SEARCH_PAGE_SIZE,
  tab: VipSearchTab = "all"
): Promise<VipSearchResult> {
  const trimmed = q.trim();
  const safePage = Math.max(1, Math.floor(page) || 1);
  if (!trimmed) {
    return { items: [], total: 0, page: safePage, pageSize, totalPages: 0 };
  }

  const blocked = await getBlockedKeywords();

  if (isMysqlDatabase() && isMysqlFulltextSearchEnabled() && blocked.length === 0) {
    try {
      return await searchIndexedMessagesFulltext(trimmed, safePage, pageSize, tab);
    } catch (error) {
      if (!isMissingFulltextIndexError(error)) throw error;
    }
  }
  return searchIndexedMessagesContains(trimmed, safePage, pageSize, tab, blocked);
}

export async function getIndexedMessage(id: string) {
  return prisma.tgIndexedMessage.findUnique({ where: { id } });
}

/** 前台详情：命中屏蔽词则视为不存在 */
export async function getPublicIndexedMessage(id: string) {
  const item = await getIndexedMessage(id);
  if (!item) return null;
  const blocked = await getBlockedKeywords();
  if (indexedMessageIsBlocked(item, blocked)) return null;
  return item;
}

const homeListOrderBy = [{ isPinned: "desc" as const }, { messageDate: "desc" as const }, { id: "desc" as const }];

/** 自动模式首页：全部索引条目（可按频道 chatId 筛选） */
export async function listIndexedMessagesForHome(limit = 200, chatIds: string[] = []) {
  const blocked = await getBlockedKeywords();
  const where = mergePrismaWhere(
    buildIndexMessagesListWhere("", chatIds),
    buildIndexedMessageBlockedExcludeWhere(blocked)
  );
  return prisma.tgIndexedMessage.findMany({
    where,
    orderBy: homeListOrderBy,
    take: limit
  });
}

/** 自动模式首页搜索（最多 80 条，可按频道 chatId 筛选） */
export async function searchIndexedMessagesForHome(q: string, limit = 80, chatIds: string[] = []) {
  const blocked = await getBlockedKeywords();
  const where = mergePrismaWhere(
    buildIndexMessagesListWhere(q, chatIds),
    buildIndexedMessageBlockedExcludeWhere(blocked)
  );
  return prisma.tgIndexedMessage.findMany({
    where,
    orderBy: homeListOrderBy,
    take: limit
  });
}

/** 热搜：按标题出现频次近似（演示 / 索引较少时兜底） */
export async function getVipHotKeywords(limit = 24): Promise<string[]> {
  const blocked = await getBlockedKeywords();
  const blockedWhere = buildIndexedMessageBlockedExcludeWhere(blocked);
  const rows = await prisma.tgIndexedMessage.findMany({
    where: Object.keys(blockedWhere).length > 0 ? blockedWhere : undefined,
    select: { title: true },
    orderBy: { messageDate: "desc" },
    take: 120
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    const word = row.title.replace(/\s+/g, "").slice(0, 12);
    if (word.length < 2 || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

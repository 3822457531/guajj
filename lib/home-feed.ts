import type { Post } from "@/lib/generated/prisma";
import { PostStatus, type TgIndexedMessage } from "@/lib/generated/prisma";
import type { HomeListTile } from "@/lib/home-post-media";
import { extractListMediaTiles } from "@/lib/home-post-media";
import {
  extractListMediaTilesFromIndex,
  indexCategoryLabel,
  indexCoverUrl
} from "@/lib/home-index-media";
import { getIndexChannelFilterOptions, parseIndexChatFilter } from "@/lib/index-message-admin";
import { getPublishedPosts, searchPublishedPosts } from "@/lib/posts";
import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/site-settings";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";
import { listIndexedMessagesForHome, searchIndexedMessagesForHome } from "@/lib/tg-index-search";

export type HomeFeedMode = "manual" | "auto";

export type HomeChannelOption = {
  id: string;
  label: string;
  count: number;
};

export { parseIndexChatFilter as parseHomeChannelFilter };

export type HomeFeedItem = {
  id: string;
  href: string;
  title: string;
  summary: string;
  categoryName: string;
  publishedAt: Date | null;
  isPinned: boolean;
  coverUrl: string;
  tiles: HomeListTile[];
};

export async function getHomeFeedMode(): Promise<HomeFeedMode> {
  const settings = await getSiteSettings();
  return settings.homeFeedMode === "auto" ? "auto" : "manual";
}

function mapPost(post: Post & { category: { name: string } }): HomeFeedItem {
  return {
    id: post.id,
    href: `/post/${post.id}`,
    title: post.title,
    summary: stripRepostAttributionFromText(post.summary),
    categoryName: post.category.name,
    publishedAt: post.publishedAt,
    isPinned: post.isPinned,
    coverUrl: post.coverUrl,
    tiles: extractListMediaTiles(post)
  };
}

function mapIndex(item: TgIndexedMessage): HomeFeedItem {
  return {
    id: item.id,
    href: `/vip/${item.id}`,
    title: item.title,
    summary: stripRepostAttributionFromText(item.snippet),
    categoryName: indexCategoryLabel(item),
    publishedAt: item.messageDate,
    isPinned: item.isPinned,
    coverUrl: indexCoverUrl(item),
    tiles: extractListMediaTilesFromIndex(item)
  };
}

export async function getHomeChannelFilterOptions(): Promise<HomeChannelOption[]> {
  const mode = await getHomeFeedMode();
  if (mode === "auto") {
    const rows = await getIndexChannelFilterOptions();
    return rows.map((r) => ({ id: r.chatId, label: r.label, count: r.count }));
  }

  const groups = await prisma.post.groupBy({
    by: ["categoryId"],
    where: { status: PostStatus.PUBLISHED },
    _count: { _all: true }
  });
  if (groups.length === 0) return [];

  const categories = await prisma.category.findMany({
    where: { id: { in: groups.map((g) => g.categoryId) } },
    orderBy: { name: "asc" }
  });
  const countById = new Map(groups.map((g) => [g.categoryId, g._count._all]));

  return categories
    .map((c) => ({
      id: c.id,
      label: c.name,
      count: countById.get(c.id) ?? 0
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

export async function getHomeFeedItems(channelIds: string[] = []): Promise<HomeFeedItem[]> {
  const mode = await getHomeFeedMode();
  if (mode === "auto") {
    const rows = await listIndexedMessagesForHome(200, channelIds);
    return rows.map(mapIndex);
  }
  const posts = await getPublishedPosts(channelIds);
  return posts.map(mapPost);
}

export async function searchHomeFeed(q: string, channelIds: string[] = []): Promise<HomeFeedItem[]> {
  const mode = await getHomeFeedMode();
  if (mode === "auto") {
    const rows = await searchIndexedMessagesForHome(q, 80, channelIds);
    return rows.map(mapIndex);
  }
  const posts = await searchPublishedPosts(q, channelIds);
  return posts.map(mapPost);
}

import type { Prisma } from "@/lib/generated/prisma";
import { PostStatus } from "@/lib/generated/prisma";
import { buildPostBlockedExcludeWhere, getBlockedKeywords, mergePrismaWhere, postIsBlocked } from "@/lib/blocked-keywords";
import { encodeHomeFeedCursor, parseHomeFeedCursor } from "@/lib/home-feed-cursor";
import { prisma } from "@/lib/prisma";

export const postInclude = {
  category: true,
  tags: { include: { tag: true } }
};

/** 首页「最新吃瓜」等同台数据：置顶优先，其余按入库时间新→旧（比 id 字串更可靠）。 */
const publishedListOrderBy = [{ isPinned: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];
const latestFeedOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

export type PublishedPostsPageResult = {
  items: Awaited<ReturnType<typeof getPublishedPosts>>;
  nextCursor: string | null;
  hasMore: boolean;
};

/** 首页轮播：置顶稿件，最多 limit 条 */
export async function listPublishedPostsPinned(limit: number, categoryIds: string[] = []) {
  const blocked = await getBlockedKeywords();
  const categoryWhere: Prisma.PostWhereInput =
    categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {};
  const where = mergePrismaWhere(
    { status: PostStatus.PUBLISHED, isPinned: true, ...categoryWhere },
    buildPostBlockedExcludeWhere(blocked)
  );
  return prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: publishedListOrderBy,
    take: limit
  });
}

/** 首页「最新吃瓜」分页（不含置顶） */
export async function listPublishedPostsLatestPage(options: {
  categoryIds?: string[];
  cursor?: string | null;
  limit?: number;
}): Promise<PublishedPostsPageResult> {
  const limit = options.limit ?? 20;
  const blocked = await getBlockedKeywords();
  const categoryIds = options.categoryIds ?? [];
  const categoryWhere: Prisma.PostWhereInput =
    categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {};
  const cursor = parseHomeFeedCursor(options.cursor);
  const cursorWhere: Prisma.PostWhereInput = cursor
    ? {
        OR: [{ createdAt: { lt: cursor.date } }, { AND: [{ createdAt: cursor.date }, { id: { lt: cursor.id } }] }]
      }
    : {};
  const where = mergePrismaWhere(
    { status: PostStatus.PUBLISHED, isPinned: false, ...categoryWhere, ...cursorWhere },
    buildPostBlockedExcludeWhere(blocked)
  );
  const rows = await prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: latestFeedOrderBy,
    take: limit + 1
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  const nextCursor = hasMore && last ? encodeHomeFeedCursor(last.createdAt, last.id) : null;
  return { items, nextCursor, hasMore };
}

export async function getPublishedPosts(categoryIds: string[] = []) {
  const blocked = await getBlockedKeywords();
  const categoryWhere: Prisma.PostWhereInput =
    categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {};
  const where = mergePrismaWhere(
    { status: PostStatus.PUBLISHED, ...categoryWhere },
    buildPostBlockedExcludeWhere(blocked)
  );
  return prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: publishedListOrderBy
  });
}

/** 前台首页关键词搜索（标题 / 摘要 / 正文 / 分类 / 标签） */
export async function searchPublishedPosts(q: string, categoryIds: string[] = []) {
  const trimmed = q.trim();
  if (!trimmed) return getPublishedPosts(categoryIds);

  const blocked = await getBlockedKeywords();
  const where: Prisma.PostWhereInput = mergePrismaWhere(
    {
      status: PostStatus.PUBLISHED,
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
      OR: [
        { title: { contains: trimmed } },
        { summary: { contains: trimmed } },
        { body: { contains: trimmed } },
        { category: { name: { contains: trimmed } } },
        { tags: { some: { tag: { name: { contains: trimmed } } } } }
      ]
    },
    buildPostBlockedExcludeWhere(blocked)
  )!;

  return prisma.post.findMany({
    where,
    include: postInclude,
    orderBy: publishedListOrderBy
  });
}

export async function getPost(id: string) {
  const post = await prisma.post.findFirst({
    where: { id, status: PostStatus.PUBLISHED },
    include: postInclude
  });
  if (!post) return null;
  const blocked = await getBlockedKeywords();
  if (postIsBlocked(post, blocked)) return null;
  return post;
}

/** 任意状态（仅应在已鉴权的管理预览中使用） */
export async function getPostAnyStatus(id: string) {
  return prisma.post.findFirst({
    where: { id },
    include: postInclude
  });
}

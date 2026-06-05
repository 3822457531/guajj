import type { Prisma } from "@/lib/generated/prisma";
import { PostStatus } from "@/lib/generated/prisma";
import { buildPostBlockedExcludeWhere, getBlockedKeywords, mergePrismaWhere, postIsBlocked } from "@/lib/blocked-keywords";
import { prisma } from "@/lib/prisma";

export const postInclude = {
  category: true,
  tags: { include: { tag: true } }
};

/** 首页「最新吃瓜」等同台数据：置顶优先，其余按入库时间新→旧（比 id 字串更可靠）。 */
const publishedListOrderBy = [{ isPinned: "desc" as const }, { createdAt: "desc" as const }, { id: "desc" as const }];

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

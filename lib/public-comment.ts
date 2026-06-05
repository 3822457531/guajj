import type { CommentWithAuthor } from "@/lib/comments-tree";
import { sanitizeCommentBody } from "@/lib/comments-tree";
import { getOrCreateAnonymousSocialUser } from "@/lib/anonymous-social-user";
import { PostStatus } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getSocialUserSessionPayload } from "@/lib/social-auth";
import { getAllowAnonymousComments } from "@/lib/site-settings";

export type CreatePublishedCommentResult =
  | { ok: true; comment: CommentWithAuthor }
  | { ok: false; status: number; error: string };

/** 前台已发布文章下发表评论，供 API 与 Server Action 共用 */
export async function createPublishedPostComment(
  postId: string,
  rawBody: string,
  parentId: string | null
): Promise<CreatePublishedCommentResult> {
  const post = await prisma.post.findFirst({ where: { id: postId, status: PostStatus.PUBLISHED } });
  if (!post) return { ok: false, status: 404, error: "文章不存在" };

  const text = sanitizeCommentBody(String(rawBody ?? ""));
  if (!text) return { ok: false, status: 400, error: "评论内容不能为空" };

  let resolvedParentId: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findFirst({ where: { id: parentId, postId } });
    if (!parent) return { ok: false, status: 400, error: "要回复的评论不存在" };
    resolvedParentId = parent.id;
  }

  const allowAnonymous = await getAllowAnonymousComments();
  const session = await getSocialUserSessionPayload();

  let author;
  if (!allowAnonymous) {
    if (!session) return { ok: false, status: 401, error: "请先登录后再评论" };
    const loggedIn = await prisma.socialUser.findUnique({ where: { id: session.socialUserId } });
    if (!loggedIn) return { ok: false, status: 401, error: "登录状态失效，请重新登录" };
    author = loggedIn;
  } else {
    author =
      session != null
        ? (await prisma.socialUser.findUnique({ where: { id: session.socialUserId } })) ??
          (await getOrCreateAnonymousSocialUser())
        : await getOrCreateAnonymousSocialUser();
  }

  try {
    const comment = await prisma.comment.create({
      data: {
        postId,
        authorId: author.id,
        parentId: resolvedParentId,
        body: text
      },
      include: { author: true }
    });
    return { ok: true, comment };
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存评论失败";
    return { ok: false, status: 500, error: message };
  }
}

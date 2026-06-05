import { notFound } from "next/navigation";
import PostComments from "@/components/post-comments";
import { PostDetailBottomBar } from "@/components/post-detail-bottom-bar";
import { PostDetailHeader } from "@/components/post-detail-header";
import { PostDetailInteractRow } from "@/components/post-detail-interact-row";
import { PostRelatedH5 } from "@/components/post-related-h5";
import { PostRichContent } from "@/components/post-rich-content";
import { buildRenderableBlocks, dropLeadingTextBlockIfEqualsBody } from "@/lib/post-content-blocks";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";
import { buildAllVideoUrls } from "@/lib/post-gallery";
import { buildCommentTree } from "@/lib/comments-tree";
import { PostStatus } from "@/lib/generated/prisma";
import { getLoggedInSocialUser } from "@/lib/social-user";
import { prisma } from "@/lib/prisma";
import { getPost } from "@/lib/posts";
import { getSiteSettings } from "@/lib/site-settings";

/** 确保发表评论后 router.refresh 会重新拉取评论列表 */
export const dynamic = "force-dynamic";

function firstQuery(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function shuffleTake<T>(items: T[], n: number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDetailTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default async function PostDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cok?: string; cerr?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const cok = firstQuery(query.cok);
  const cerrRaw = firstQuery(query.cerr);
  const commentFlash =
    cok === "1"
      ? ({ kind: "ok" } as const)
      : cerrRaw
        ? ({
            kind: "error",
            message: (() => {
              try {
                return decodeURIComponent(cerrRaw);
              } catch {
                return "评论发送失败";
              }
            })()
          } as const)
        : null;
  const post = await getPost(id);
  if (!post) notFound();

  await prisma.post.update({ where: { id: post.id }, data: { views: { increment: 1 } } });

  const timeSource = post.publishedAt ?? post.createdAt;
  const timeLabel = formatDetailTime(timeSource);

  const [relatedPool, commentRows, socialUser, siteSettings] = await Promise.all([
    prisma.post.findMany({
      where: { status: PostStatus.PUBLISHED, id: { not: post.id }, categoryId: post.categoryId },
      take: 32,
      orderBy: { views: "desc" },
      select: {
        id: true,
        title: true,
        category: { select: { name: true } }
      }
    }),
    prisma.comment.findMany({
      where: { postId: post.id },
      include: { author: true },
      orderBy: { createdAt: "asc" }
    }),
    getLoggedInSocialUser(),
    getSiteSettings()
  ]);

  const relatedInitial = shuffleTake(relatedPool, 4);
  const commentTree = buildCommentTree(commentRows);
  const currentUser = socialUser
    ? {
        id: socialUser.id,
        nickname: socialUser.nickname,
        faceimg: socialUser.faceimg,
        loginType: socialUser.loginType
      }
    : null;

  const bodyDisplay = stripRepostAttributionFromText(post.body);
  const richBlocks = dropLeadingTextBlockIfEqualsBody(buildRenderableBlocks(post), post.body);
  const videoMissing = post.type === "VIDEO" && buildAllVideoUrls(post).length === 0;

  return (
    <main className="site-shell h5-detail-page">
      <PostDetailHeader />

      <div className="h5-detail-main">
        <article className="h5-detail-card">
          <div className="h5-detail-card-inner">
            <span className="h5-detail-cat-pill">{post.category.name}</span>
            <h1 className="h5-detail-title">{post.title}</h1>

            <div className="h5-detail-meta">
              <span className="h5-detail-meta-time">{timeLabel}</span>
            </div>

            {bodyDisplay.trim() ? (
              <div className="h5-detail-quote" lang="zh-Hans">
                <span className="h5-detail-quote-mark" aria-hidden>
                  “
                </span>
                <p className="h5-detail-quote-body">{bodyDisplay}</p>
              </div>
            ) : null}

            {/* <div className="h5-detail-contrib">
              <div className="h5-detail-contrib-avatar" aria-hidden>
                🐣
              </div>
              <div className="h5-detail-contrib-text">
                <div>投稿来自 匿名吃瓜群众</div>
                <div className="h5-detail-contrib-sub">{post.summary.slice(0, 24)}{post.summary.length > 24 ? "…" : ""}</div>
              </div>
            </div>

            <p className="h5-detail-card-foot">
              😂 {post.category.name} | 🧨 欢迎投稿
            </p> */}

            <PostRichContent blocks={richBlocks} videoMissingHint={videoMissing} />

            {post.tags.length > 0 ? (
              <div className="h5-detail-tags">
                {post.tags.map(({ tag }) => (
                  <span key={tag.id} className="h5-detail-tag-pill">
                    #{tag.name}
                  </span>
                ))}
              </div>
            ) : null}

            <PostDetailInteractRow commentCount={commentRows.length} />
          </div>
        </article>

        <PostRelatedH5 postId={post.id} initialItems={relatedInitial} />

        <div className="h5-detail-comments-wrap">
          <PostComments
            key={post.id}
            postId={post.id}
            initialTree={commentTree}
            currentUser={currentUser}
            commentFlash={commentFlash}
            allowAnonymousComments={siteSettings.allowAnonymousComments}
            variant="h5"
          />
        </div>
      </div>

      <PostDetailBottomBar />
    </main>
  );
}

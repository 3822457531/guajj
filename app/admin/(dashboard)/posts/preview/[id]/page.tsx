import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import { notFound } from "next/navigation";
import { PostRichContent } from "@/components/post-rich-content";
import { buildRenderableBlocks } from "@/lib/post-content-blocks";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";
import { buildAllVideoUrls } from "@/lib/post-gallery";
import { requireAdmin } from "@/lib/auth";
import { getPostAnyStatus } from "@/lib/posts";

const statusLabel: Record<string, string> = {
  PUBLISHED: "已发布",
  DRAFT: "草稿",
  ARCHIVED: "已下架"
};

export default async function AdminPostPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const post = await getPostAnyStatus(id);
  if (!post) notFound();

  const blocks = buildRenderableBlocks(post);
  const videoMissing = post.type === "VIDEO" && buildAllVideoUrls(post).length === 0;
  const summaryDisplay = stripRepostAttributionFromText(post.summary);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="admin-page-toolbar">
        <span className="chip">{statusLabel[post.status] || post.status}</span>
        <AdminLink className="btn-admin-ghost" href={`${adminPath("/posts")}?edit=${post.id}`} style={{ textDecoration: "none", display: "inline-flex" }}>
          返回编辑
        </AdminLink>
        {post.status === "PUBLISHED" ? (
          <AdminLink className="btn btn-admin-primary" href={`/post/${post.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            打开前台详情
          </AdminLink>
        ) : null}
      </div>
      <p className="admin-page-note">草稿与下架内容在前台 `/post/…` 不会展示；此处核对摘要、混排块与媒体是否正常。</p>

      <article className="article admin-panel admin-preview-article" style={{ marginTop: 12 }}>
        <div className="article-body">
          <span className="chip">{post.category.name}</span>
          <h1>{post.title}</h1>
          <div className="story-meta">
            <span>浏览量 {post.views}</span>
            {post.tags.map(({ tag }) => (
              <span key={tag.id}>#{tag.name}</span>
            ))}
          </div>
          {summaryDisplay.trim() ? (
            <blockquote style={{ margin: "16px 0", padding: "12px 16px", borderLeft: "4px solid var(--brand)", background: "#f9fafb" }}>
              {summaryDisplay}
            </blockquote>
          ) : null}
          <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 16, marginTop: 16 }}>
            <PostRichContent blocks={blocks} videoMissingHint={videoMissing} />
          </div>
        </div>
      </article>
    </div>
  );
}

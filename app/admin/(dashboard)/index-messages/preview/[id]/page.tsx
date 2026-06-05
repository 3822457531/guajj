import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import { notFound } from "next/navigation";
import { AdminIndexMediaPreview } from "@/components/admin-index-media-preview";
import { PostRichContent } from "@/components/post-rich-content";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveContentBlocksMedia } from "@/lib/resolve-media-src";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";
import { buildRenderableBlocksForIndex, dropLeadingTextBlockIfEqualsBody } from "@/lib/tg-index-content-blocks";
import { buildIndexAllVideoUrls } from "@/lib/tg-index-gallery";
import { contentTypeLabel } from "@/lib/tg-index-display";

export default async function AdminIndexMessagePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const item = await prisma.tgIndexedMessage.findUnique({ where: { id } });
  if (!item) notFound();

  const richBlocks = resolveContentBlocksMedia(
    dropLeadingTextBlockIfEqualsBody(buildRenderableBlocksForIndex(item), item.rawText || "")
  );
  const videoMissing = item.contentType === "VIDEO" && buildIndexAllVideoUrls(item).length === 0;
  const summaryDisplay = stripRepostAttributionFromText(item.snippet);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div className="admin-page-toolbar">
        <span className="chip">{contentTypeLabel(item.contentType)}</span>
        <AdminLink className="btn-admin-ghost" href={`${adminPath("/index-messages")}?edit=${item.id}`} style={{ textDecoration: "none", display: "inline-flex" }}>
          返回编辑
        </AdminLink>
        <AdminLink className="btn btn-admin-primary" href={`/vip/${item.id}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          打开前台详情
        </AdminLink>
      </div>
      <p className="admin-page-note">核对摘要、混排块与媒体是否正常。若图片 404，请检查文件是否在 public/uploads 或 R2 公网地址可访问。</p>

      <article className="article admin-panel admin-preview-article" style={{ marginTop: 12 }}>
        <div className="article-body">
          <span className="chip">{item.sourceTitle || item.sourceUsername || "频道"}</span>
          <h1>{item.title}</h1>
          <div className="story-meta">
            <span>浏览量 {item.views}</span>
            <span>排序热度 {item.heat}</span>
            {item.isPinned ? <span>👑 置顶</span> : null}
          </div>
          {summaryDisplay.trim() ? (
            <blockquote style={{ margin: "16px 0", padding: "12px 16px", borderLeft: "4px solid var(--brand)", background: "#f9fafb" }}>
              {summaryDisplay}
            </blockquote>
          ) : null}

          <div className="field" style={{ marginTop: 16 }}>
            <label>媒体预览</label>
            <AdminIndexMediaPreview item={item} />
          </div>

          <div style={{ background: "#1a1a1a", borderRadius: 12, padding: 16, marginTop: 16 }}>
            <PostRichContent blocks={richBlocks} videoMissingHint={videoMissing} />
          </div>
        </div>
      </article>
    </div>
  );
}

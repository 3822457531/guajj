import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { resolveMediaSrc } from "@/lib/resolve-media-src";
import { buildIndexAllVideoUrls, buildIndexGalleryImageUrls, parseIndexGalleryExtras } from "@/lib/tg-index-gallery";

function parseGalleryUrls(raw: string | null | undefined): string[] {
  return parseIndexGalleryExtras(raw)
    .map((u) => resolveMediaSrc(u))
    .filter((u): u is string => Boolean(u));
}

export function AdminIndexMediaPreview({ item }: { item: TgIndexedMessage }) {
  const mainMedia = resolveMediaSrc(item.mediaUrl);
  const images = buildIndexGalleryImageUrls(item)
    .map((u) => resolveMediaSrc(u))
    .filter((u): u is string => Boolean(u));
  const extraImages = parseGalleryUrls(item.galleryImageUrls).filter((u) => !images.includes(u));
  const allImages = [...images, ...extraImages];
  const videos = buildIndexAllVideoUrls(item)
    .map((u) => resolveMediaSrc(u))
    .filter((u): u is string => Boolean(u));

  const hasAny = Boolean(mainMedia && !allImages.includes(mainMedia)) || allImages.length > 0 || videos.length > 0;

  if (!hasAny) {
    return (
      <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
        暂无媒体 URL。若采集未下载到本地，请确认 <code>public/uploads</code> 或 R2 公网前缀是否可访问。
      </p>
    );
  }

  return (
    <div className="admin-index-media-preview">
      {mainMedia && item.contentType === "VIDEO" && !videos.includes(mainMedia) ? (
        <div className="admin-media-preview-block">
          <span className="admin-media-preview-label">主视频（mediaUrl）</span>
          <video src={mainMedia} controls preload="metadata" style={{ width: "100%", maxHeight: 240 }} />
          <code className="admin-media-preview-url">{item.mediaUrl}</code>
        </div>
      ) : null}

      {mainMedia && item.contentType === "PHOTO" && !allImages.includes(mainMedia) ? (
        <div className="admin-media-preview-block">
          <span className="admin-media-preview-label">主图（mediaUrl）</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mainMedia} alt="" className="admin-media-preview-img" />
          <code className="admin-media-preview-url">{item.mediaUrl}</code>
        </div>
      ) : null}

      {videos.length > 0 ? (
        <div className="admin-media-preview-block">
          <span className="admin-media-preview-label">视频（{videos.length}）</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {videos.map((src) => (
              <div key={src}>
                <video src={src} controls preload="metadata" style={{ width: "100%", maxHeight: 240 }} />
                <code className="admin-media-preview-url">{src}</code>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {allImages.length > 0 ? (
        <div className="admin-media-preview-block">
          <span className="admin-media-preview-label">图片（{allImages.length}）</span>
          <div className="admin-media-preview-thumbs">
            {allImages.map((src) => (
              <a key={src} href={src} target="_blank" rel="noreferrer" title="新窗口打开">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="admin-media-preview-thumb" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

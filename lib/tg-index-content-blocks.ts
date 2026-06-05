import type { TgIndexedMessage } from "@/lib/generated/prisma";
import {
  dropLeadingTextBlockIfEqualsBody,
  parseContentBlocks,
  type ContentBlock
} from "@/lib/post-content-blocks";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";
import { buildIndexAllVideoUrls, buildIndexGalleryImageUrls, isLikelyImageUrl } from "@/lib/tg-index-gallery";

function stripTextBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks
    .map((b) => (b.type === "text" ? { ...b, text: stripRepostAttributionFromText(b.text) } : b))
    .filter((b) => !(b.type === "text" && !b.text.trim()));
}

function sanitizeImageUrls(urls: string[]): string[] {
  return urls.filter(isLikelyImageUrl);
}

function mergeGalleryIntoBlocks(blocks: ContentBlock[], item: TgIndexedMessage): ContentBlock[] {
  const canonical = buildIndexGalleryImageUrls(item);
  if (canonical.length === 0) {
    return blocks
      .map((b) => (b.type === "images" ? { ...b, urls: sanitizeImageUrls(b.urls) } : b))
      .filter((b) => !(b.type === "images" && b.urls.length === 0)) as ContentBlock[];
  }

  const out = blocks.map((b) =>
    b.type === "images" ? { ...b, urls: [...b.urls] } : b
  ) as ContentBlock[];

  const idx = out.findIndex((b) => b.type === "images");
  if (idx < 0) {
    out.push({ type: "images", urls: [...canonical] });
    return out;
  }

  const cur = out[idx] as Extract<ContentBlock, { type: "images" }>;
  cur.urls = sanitizeImageUrls(cur.urls);
  if (cur.urls.length === 0) {
    out.splice(idx, 1);
    out.push({ type: "images", urls: [...canonical] });
    return out;
  }
  const curSet = new Set(cur.urls);
  const subset = cur.urls.length > 0 && cur.urls.every((u) => canonical.includes(u));
  if (subset && canonical.length > cur.urls.length) {
    out[idx] = { type: "images", urls: [...canonical] };
    return out;
  }
  const missing = canonical.filter((u) => !curSet.has(u));
  if (missing.length === 0) return out;
  out[idx] = { type: "images", urls: [...cur.urls, ...missing] };
  return out;
}

/** VIP 详情混排：优先 contentBlocks，否则按 Post 同款规则自动组装 */
export function buildRenderableBlocksForIndex(item: TgIndexedMessage): ContentBlock[] {
  const parsed = parseContentBlocks(item.contentBlocks);
  if (parsed?.length) {
    return stripTextBlocks(mergeGalleryIntoBlocks(parsed, item));
  }

  const blocks: ContentBlock[] = [];
  const body = stripRepostAttributionFromText(item.rawText?.trim() ?? "");
  const skipBody =
    !body || body === "(无文字)" || body === "无标题" || body === item.title.trim();
  if (body && !skipBody) blocks.push({ type: "text", text: body });

  const videoUrls = buildIndexAllVideoUrls(item);
  const hasVideo = videoUrls.length > 0;
  const poster =
    item.contentType === "PHOTO" && item.mediaUrl?.trim() ? item.mediaUrl.trim() : null;
  for (const src of videoUrls) {
    blocks.push({ type: "video", src, poster });
  }

  const galleryStrip = buildIndexGalleryImageUrls(item);
  let imageUrls = galleryStrip;
  if (imageUrls.length === 0 && item.mediaUrl?.trim() && item.contentType === "PHOTO") {
    imageUrls = [item.mediaUrl.trim()];
  }

  if (imageUrls.length > 0) {
    if (!hasVideo || imageUrls.length > 1) {
      blocks.push({ type: "images", urls: imageUrls });
    }
  }

  return blocks;
}

export { dropLeadingTextBlockIfEqualsBody };

import type { Post } from "@/lib/generated/prisma";
import { buildAllVideoUrls, buildGalleryImageUrls } from "@/lib/post-gallery";
import { stripRepostAttributionFromText } from "@/lib/strip-repost-attribution";

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "video"; src: string; poster?: string | null }
  | { type: "images"; urls: string[] };

const PLACEHOLDER_COVER_RE = /^\/assets\/cover-/;

/** 解析后台保存的 JSON 混排块；无效则返回 null */
export function parseContentBlocks(raw: string | null | undefined): ContentBlock[] | null {
  if (!raw?.trim()) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data) || data.length === 0) return null;
    const out: ContentBlock[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (o.type === "text" && typeof o.text === "string") {
        out.push({ type: "text", text: o.text });
      } else if (o.type === "video" && typeof o.src === "string") {
        out.push({
          type: "video",
          src: o.src,
          poster: typeof o.poster === "string" ? o.poster : null
        });
      } else if (o.type === "images" && Array.isArray(o.urls)) {
        const urls = o.urls.filter((u): u is string => typeof u === "string" && u.length > 0);
        if (urls.length) out.push({ type: "images", urls });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/**
 * 前台混排：优先 `contentBlocks` JSON；
 * 否则用正文 + 视频 + 图/封面按「文字在前、多媒体在后」自动组装（与设计图一致）。
 */
function stripTextBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return blocks
    .map((b) => (b.type === "text" ? { ...b, text: stripRepostAttributionFromText(b.text) } : b))
    .filter((b) => !(b.type === "text" && !b.text.trim()));
}

/**
 * 混排 JSON 若只含部分图片（常见：导入时只写了封面一张），与库里「封面 + 图集额外图」对齐。
 * 当首段 `images` 的 URL 全是 canonical 的子集且 canonical 更完整时，整段替换为 canonical，顺序与后台图集一致。
 */
function mergeGalleryImagesIntoParsedBlocks(blocks: ContentBlock[], post: Post): ContentBlock[] {
  const canonical = buildGalleryImageUrls(post);
  if (canonical.length === 0) return blocks;

  const out = blocks.map((b) =>
    b.type === "images" ? { ...b, urls: [...b.urls] } : b
  ) as ContentBlock[];

  const idx = out.findIndex((b) => b.type === "images");
  if (idx < 0) {
    out.push({ type: "images", urls: [...canonical] });
    return out;
  }

  const cur = out[idx] as Extract<ContentBlock, { type: "images" }>;
  const curSet = new Set(cur.urls);
  const subsetOfCanonical = cur.urls.length > 0 && cur.urls.every((u) => canonical.includes(u));

  if (subsetOfCanonical && canonical.length > cur.urls.length) {
    out[idx] = { type: "images", urls: [...canonical] };
    return out;
  }

  const missing = canonical.filter((u) => !curSet.has(u));
  if (missing.length === 0) return out;

  out[idx] = { type: "images", urls: [...cur.urls, ...missing] };
  return out;
}

/**
 * H5 详情：正文单独用「摘要引用」样式展示时，若混排首块 text 与库里的 body 一致则去掉，避免重复。
 */
export function dropLeadingTextBlockIfEqualsBody(blocks: ContentBlock[], rawBody: string): ContentBlock[] {
  const bodyNorm = stripRepostAttributionFromText(rawBody.trim());
  if (!bodyNorm) return blocks;
  const first = blocks[0];
  if (!first || first.type !== "text") return blocks;
  const firstNorm = stripRepostAttributionFromText(first.text.trim());
  if (firstNorm === bodyNorm) return blocks.slice(1);
  return blocks;
}

export function buildRenderableBlocks(post: Post): ContentBlock[] {
  const parsed = parseContentBlocks(post.contentBlocks);
  if (parsed?.length) {
    return stripTextBlocks(mergeGalleryImagesIntoParsedBlocks(parsed, post));
  }

  const blocks: ContentBlock[] = [];
  const body = stripRepostAttributionFromText(post.body?.trim() ?? "");
  if (body) blocks.push({ type: "text", text: body });

  const videoUrls = buildAllVideoUrls(post);
  const hasAnyVideo = videoUrls.length > 0;
  const cover = post.coverUrl?.trim();
  const poster = cover && !PLACEHOLDER_COVER_RE.test(cover) ? cover : null;
  for (const src of videoUrls) {
    blocks.push({ type: "video", src, poster });
  }

  const galleryStrip = buildGalleryImageUrls(post);
  let imageUrls = galleryStrip;
  if (imageUrls.length === 0 && post.coverUrl && !PLACEHOLDER_COVER_RE.test(post.coverUrl)) {
    imageUrls = [post.coverUrl];
  }

  if (imageUrls.length > 0) {
    if (!hasAnyVideo) {
      blocks.push({ type: "images", urls: imageUrls });
    } else if (post.type === "GALLERY" || galleryStrip.length > 1) {
      blocks.push({ type: "images", urls: imageUrls });
    }
  }

  return blocks;
}

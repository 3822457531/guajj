import type { Post } from "@/lib/generated/prisma";

export function parseGalleryExtras(galleryImageUrls: string | null | undefined): string[] {
  if (!galleryImageUrls) return [];
  try {
    const parsed = JSON.parse(galleryImageUrls) as unknown;
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * 多图列表：封面 + 图集额外图（去重）。
 * - `GALLERY`：始终返回封面 + 额外图。
 * - `ARTICLE` / `VIDEO`：若 Telegram 等多图只写在「额外图 JSON」里（未改类型），同样返回完整列表，避免前台只显示封面一张。
 */
export function buildGalleryImageUrls(post: Post): string[] {
  const extras = parseGalleryExtras(post.galleryImageUrls);
  const cover = post.coverUrl?.trim();
  if (post.type === "GALLERY") {
    if (!cover) return extras.filter(Boolean);
    return [cover, ...extras.filter((u) => u && u !== cover)];
  }
  if (extras.length > 0 && cover) {
    return [cover, ...extras.filter((u) => u && u !== cover)];
  }
  return [];
}

export function parseGalleryVideos(galleryVideoUrls: string | null | undefined): string[] {
  if (!galleryVideoUrls?.trim()) return [];
  try {
    const parsed = JSON.parse(galleryVideoUrls) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((s) => s.trim())
      : [];
  } catch {
    return [];
  }
}

/** 主视频 + 额外视频（去重，顺序：videoUrl 在前） */
export function buildAllVideoUrls(post: Post): string[] {
  const out: string[] = [];
  const main = post.videoUrl?.trim();
  if (main) out.push(main);
  for (const u of parseGalleryVideos(post.galleryVideoUrls)) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

import type { TgIndexedMessage } from "@/lib/generated/prisma";

const VIDEO_URL_RE = /\.(mp4|webm|mov|m4v|mkv|avi|mpeg|mpg|3gp)(\?|$)/i;

/** 根据 URL 后缀判断是否为视频地址（避免把 mp4 当 img src） */
export function isLikelyVideoUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url.trim());
}

export function isLikelyImageUrl(url: string): boolean {
  const u = url.trim();
  return Boolean(u) && !isLikelyVideoUrl(u);
}

export function parseIndexGalleryExtras(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

/** 封面 mediaUrl + galleryImageUrls（去重；VIDEO 的 mediaUrl 不算图片） */
export function buildIndexGalleryImageUrls(item: TgIndexedMessage): string[] {
  const extras = parseIndexGalleryExtras(item.galleryImageUrls).filter(isLikelyImageUrl);
  const cover = item.mediaUrl?.trim();

  if (item.contentType === "PHOTO") {
    if (!cover || !isLikelyImageUrl(cover)) return extras;
    return [cover, ...extras.filter((u) => u !== cover)];
  }

  if (extras.length > 0) {
    if (cover && isLikelyImageUrl(cover) && !extras.includes(cover)) {
      return [cover, ...extras];
    }
    return extras;
  }

  return [];
}

export function buildIndexAllVideoUrls(item: TgIndexedMessage): string[] {
  const out: string[] = [];
  const main = item.contentType === "VIDEO" ? item.mediaUrl?.trim() : null;
  if (main) out.push(main);
  for (const u of parseIndexGalleryExtras(item.galleryVideoUrls)) {
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}

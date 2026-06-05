import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { TgIndexContentType } from "@/lib/generated/prisma";
import { extractListMediaTilesFromIndex } from "@/lib/home-index-media";
import { buildIndexAllVideoUrls, buildIndexGalleryImageUrls } from "@/lib/tg-index-gallery";
import { resolveMediaSrc } from "@/lib/resolve-media-src";

export type VipResultMediaKind = "video" | "image" | "text";

export type VipSearchTab = "all" | "news" | "video" | "image" | "post";

export const VIP_SEARCH_TABS: { id: VipSearchTab; label: string }[] = [
  { id: "all", label: "全部" },
  // { id: "news", label: "爆料" },
  { id: "video", label: "视频" },
  { id: "image", label: "图片" },
  { id: "post", label: "帖子" }
];

/** 展示优先级：有视频 → 视频；否则有图 → 图片；否则纯文字 */
export function resolveVipResultMediaKind(item: TgIndexedMessage): VipResultMediaKind {
  if (buildIndexAllVideoUrls(item).length > 0) return "video";
  const tiles = extractListMediaTilesFromIndex(item);
  if (tiles.some((t) => t.kind === "video")) return "video";
  if (buildIndexGalleryImageUrls(item).length > 0) return "image";
  if (tiles.some((t) => t.kind === "image")) return "image";
  if (item.contentType === TgIndexContentType.VIDEO) return "video";
  if (item.contentType === TgIndexContentType.PHOTO) return "image";
  return "text";
}

export function resolveVipResultThumbnail(item: TgIndexedMessage): {
  kind: VipResultMediaKind;
  url: string | null;
  poster: string | null;
} {
  const kind = resolveVipResultMediaKind(item);
  if (kind === "video") {
    const videos = buildIndexAllVideoUrls(item);
    const videoUrl = resolveMediaSrc(videos[0]);
    const images = buildIndexGalleryImageUrls(item);
    const poster = resolveMediaSrc(images[0]);
    return { kind, url: videoUrl, poster };
  }
  if (kind === "image") {
    const images = buildIndexGalleryImageUrls(item);
    return { kind, url: resolveMediaSrc(images[0]), poster: null };
  }
  return { kind, url: null, poster: null };
}

export function itemMatchesVipSearchTab(item: TgIndexedMessage, tab: VipSearchTab): boolean {
  if (tab === "all") return true;
  const kind = resolveVipResultMediaKind(item);
  if (tab === "news") return kind === "text";
  if (tab === "video") return kind === "video";
  if (tab === "image") return kind === "image";
  if (tab === "post") return kind === "text";
  return true;
}

export function parseVipSearchTab(raw: string | undefined): VipSearchTab {
  if (raw === "news" || raw === "video" || raw === "image" || raw === "post") return raw;
  return "all";
}

export function formatHeat(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1).replace(/\.0$/, "")}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function vipSourceLabel(item: TgIndexedMessage): string {
  if (item.sourceUsername?.trim()) {
    const u = item.sourceUsername.trim();
    return u.startsWith("@") ? u : `@${u}`;
  }
  if (item.sourceTitle?.trim()) return item.sourceTitle.trim();
  return "未知来源";
}

/** 纯文字列表左侧「爆」字色块，与序号稳定对应 */
export function vipTextBadgeTone(id: string): string {
  const tones = ["tone-red", "tone-purple", "tone-orange", "tone-green", "tone-blue"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * (i + 1)) % tones.length;
  return tones[hash] ?? tones[0];
}

import type { TgIndexedMessage } from "@/lib/generated/prisma";
import type { HomeListTile } from "@/lib/home-post-media";
import { buildRenderableBlocksForIndex } from "@/lib/tg-index-content-blocks";
import { buildIndexGalleryImageUrls, isLikelyImageUrl } from "@/lib/tg-index-gallery";

export function extractListMediaTilesFromIndex(item: TgIndexedMessage): HomeListTile[] {
  const tiles: HomeListTile[] = [];
  for (const b of buildRenderableBlocksForIndex(item)) {
    if (b.type === "images") {
      for (const url of b.urls) {
        if (url) tiles.push({ kind: "image", url });
      }
    } else if (b.type === "video") {
      tiles.push({ kind: "video", url: b.src, poster: b.poster ?? undefined });
    }
  }
  return tiles;
}

export function indexCoverUrl(item: TgIndexedMessage): string {
  const images = buildIndexGalleryImageUrls(item);
  if (images[0]) return images[0];
  const media = item.mediaUrl?.trim() || "";
  return isLikelyImageUrl(media) ? media : "";
}

export function indexCategoryLabel(item: TgIndexedMessage): string {
  if (item.sourceTitle?.trim()) return item.sourceTitle.trim();
  if (item.sourceUsername?.trim()) {
    const u = item.sourceUsername.trim();
    return u.startsWith("@") ? u : `@${u}`;
  }
  return "频道";
}

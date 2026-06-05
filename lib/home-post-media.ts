import type { Post } from "@/lib/generated/prisma";
import { buildRenderableBlocks } from "@/lib/post-content-blocks";

export type HomeListTile =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster?: string | null };

/**
 * 首页列表拼版：从混排块 / 正文中抽出所有图片与视频 URL，顺序与详情页一致。
 */
export function extractListMediaTiles(post: Post): HomeListTile[] {
  const tiles: HomeListTile[] = [];
  for (const b of buildRenderableBlocks(post)) {
    if (b.type === "images") {
      for (const url of b.urls) {
        if (url) tiles.push({ kind: "image", url });
      }
    } else if (b.type === "video") {
      tiles.push({ kind: "video", url: b.src, poster: b.poster ?? undefined });
    }
  }
  /** 纯文字稿：无混排图/视频块时不再用封面兜底拼版，列表不显示拼图区 */
  return tiles;
}

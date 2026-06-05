import type { ContentBlock } from "@/lib/post-content-blocks";

/** 将库内媒体路径转为浏览器可请求的地址（站内 /uploads 或绝对外链） */
export function resolveMediaSrc(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/${trimmed.replace(/^\/+/, "")}`;
}

/** 混排块内图片/视频 URL 统一解析，便于后台预览 */
export function resolveContentBlocksMedia(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((block) => {
    if (block.type === "video") {
      return {
        ...block,
        src: resolveMediaSrc(block.src) ?? block.src,
        poster: block.poster ? resolveMediaSrc(block.poster) ?? block.poster : block.poster
      };
    }
    if (block.type === "images") {
      return { ...block, urls: block.urls.map((u) => resolveMediaSrc(u) ?? u) };
    }
    return block;
  });
}

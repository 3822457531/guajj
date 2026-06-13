import type { ChannelMediaItem, ChannelMessageItem } from "@/lib/jisou-search-types";

export type ChannelThumbMap = Record<string, { url: string; cached?: boolean }>;

/** 客户端并发池：用于 play-info / cached 探测 */
export async function runAsyncPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Math.min(Math.max(1, concurrency), items.length);

  async function worker() {
    while (cursor < items.length) {
      if (signal?.aborted) break;
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export function collectChannelVideoIds(messages: ChannelMessageItem[]): number[] {
  const ids = new Set<number>();
  for (const msg of messages) {
    if (msg.sensitiveBlocked) continue;
    for (const mi of msg.mediaItems || []) {
      if (mi.contentType === "VIDEO" && !mi.fullUrl) {
        ids.add(mi.id);
      }
    }
  }
  return Array.from(ids);
}

export function collectChannelThumbIds(messages: ChannelMessageItem[]): number[] {
  const ids = new Set<number>();
  for (const msg of messages) {
    if (msg.sensitiveBlocked) continue;
    for (const mi of msg.mediaItems || []) {
      if ((mi.contentType === "PHOTO" || mi.contentType === "VIDEO") && !mi.thumbUrl) {
        ids.add(mi.id);
      }
    }
  }
  return Array.from(ids);
}

export function mergeChannelThumbMap(
  messages: ChannelMessageItem[],
  media: ChannelThumbMap
): ChannelMessageItem[] {
  if (!Object.keys(media).length) return messages;

  return messages.map((msg) => {
    let coverUrl = msg.coverUrl ?? null;
    let mediaItems = (msg.mediaItems || []).map((mi) =>
      applyThumbToItem(mi, media, (url) => {
        if (!coverUrl) coverUrl = url;
      })
    );

    // 单图消息：batch 键可能与消息 id 对齐
    if (mediaItems.length === 1 && !mediaItems[0]?.thumbUrl) {
      const directUrl = lookupThumbUrl(media, msg.id);
      if (directUrl) {
        mediaItems = [
          {
            ...mediaItems[0]!,
            thumbUrl: directUrl,
            status: "thumb_ready"
          }
        ];
        if (!coverUrl) coverUrl = directUrl;
      }
    }

    const visual = mediaItems.filter((m) => m.contentType === "PHOTO" || m.contentType === "VIDEO");
    let mediaStatus = msg.mediaStatus ?? null;
    if (visual.length) {
      const ready = visual.filter((m) => m.status === "thumb_ready" || m.status === "ready").length;
      if (ready === 0) mediaStatus = "pending";
      else if (ready >= visual.length) mediaStatus = "thumb_ready";
      else mediaStatus = "partial";
    }

    return { ...msg, mediaItems, coverUrl, mediaStatus };
  });
}

function lookupThumbUrl(media: ChannelThumbMap, id: number): string | null {
  const key = String(id);
  const hit = media[key] ?? (media as Record<number, { url?: string }>)[id];
  return hit?.url ?? null;
}

export function mergeChannelFullUrlMap(
  messages: ChannelMessageItem[],
  updates: Record<number, { url: string }>
): ChannelMessageItem[] {
  if (!Object.keys(updates).length) return messages;

  return messages.map((msg) => {
    const mediaItems = (msg.mediaItems || []).map((mi) => {
      const hit = updates[mi.id];
      if (!hit?.url || mi.contentType !== "VIDEO") return mi;
      return { ...mi, fullUrl: hit.url, status: "ready" as const };
    });
    return { ...msg, mediaItems };
  });
}

function applyThumbToItem(
  mi: ChannelMediaItem,
  media: ChannelThumbMap,
  onCover: (url: string) => void
): ChannelMediaItem {
  const url = lookupThumbUrl(media, mi.id);
  if (!url) return mi;
  onCover(url);
  return {
    ...mi,
    thumbUrl: url,
    status: mi.status === "pending" || mi.status === "thumb_ready" ? "thumb_ready" : mi.status
  };
}

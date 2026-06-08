import type { ChannelMediaItem, ChannelMessageItem } from "@/lib/jisou-search-types";

export type ChannelThumbMap = Record<string, { url: string; cached?: boolean }>;

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
    const mediaItems = (msg.mediaItems || []).map((mi) => applyThumbToItem(mi, media, (url) => {
      if (!coverUrl) coverUrl = url;
    }));

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

function applyThumbToItem(
  mi: ChannelMediaItem,
  media: ChannelThumbMap,
  onCover: (url: string) => void
): ChannelMediaItem {
  const hit = media[String(mi.id)];
  if (!hit?.url) return mi;
  onCover(hit.url);
  return {
    ...mi,
    thumbUrl: hit.url,
    status: mi.status === "pending" || mi.status === "thumb_ready" ? "thumb_ready" : mi.status
  };
}

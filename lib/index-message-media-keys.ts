import type { TgIndexedMessage } from "@/lib/generated/prisma";
import type { SiteSettings } from "@/lib/generated/prisma";
import { urlToObjectKey } from "@/lib/media-storage";
import { parseContentBlocks } from "@/lib/post-content-blocks";
import { getSiteSettings } from "@/lib/site-settings";
import { buildIndexAllVideoUrls, buildIndexGalleryImageUrls, parseIndexGalleryExtras } from "@/lib/tg-index-gallery";

function collectUrlsFromItem(item: TgIndexedMessage): string[] {
  const urls = new Set<string>();

  const mediaUrl = item.mediaUrl?.trim();
  if (mediaUrl) urls.add(mediaUrl);

  for (const u of buildIndexGalleryImageUrls(item)) urls.add(u);
  for (const u of buildIndexAllVideoUrls(item)) urls.add(u);
  for (const u of parseIndexGalleryExtras(item.galleryImageUrls)) urls.add(u);
  for (const u of parseIndexGalleryExtras(item.galleryVideoUrls)) urls.add(u);

  const blocks = parseContentBlocks(item.contentBlocks);
  if (blocks) {
    for (const block of blocks) {
      if (block.type === "video") {
        urls.add(block.src);
        if (block.poster?.trim()) urls.add(block.poster.trim());
      } else if (block.type === "images") {
        for (const u of block.urls) urls.add(u);
      }
    }
  }

  return [...urls];
}

export function collectIndexMessageMediaKeysFromUrls(urls: string[], settings: SiteSettings): string[] {
  const keys = new Set<string>();
  for (const url of urls) {
    const key = urlToObjectKey(url, settings);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function collectIndexMessageMediaKeys(item: TgIndexedMessage, settings: SiteSettings): string[] {
  return collectIndexMessageMediaKeysFromUrls(collectUrlsFromItem(item), settings);
}

export async function collectIndexMessageMediaKeysAsync(item: TgIndexedMessage): Promise<string[]> {
  const settings = await getSiteSettings();
  return collectIndexMessageMediaKeys(item, settings);
}

export async function collectIndexMessagesMediaKeysAsync(items: TgIndexedMessage[]): Promise<string[]> {
  const settings = await getSiteSettings();
  const keys = new Set<string>();
  for (const item of items) {
    for (const key of collectIndexMessageMediaKeys(item, settings)) {
      keys.add(key);
    }
  }
  return [...keys];
}

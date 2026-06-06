import {
  LazyPhotoThumb as BaseLazyPhotoThumb,
  LazyVideoPlayer as BaseLazyVideoPlayer,
  MessageMediaGallery as BaseMessageMediaGallery
} from "@/components/tg-search-media";
import { TG_SEARCH_API } from "@/lib/tg-search-api-paths";
import type { ChannelMediaItem } from "@/lib/jisou-search-types";
import type { ComponentProps } from "react";

const TEST_API = TG_SEARCH_API.test;

export function LazyPhotoThumb(
  props: Omit<ComponentProps<typeof BaseLazyPhotoThumb>, "apiBase">
) {
  return <BaseLazyPhotoThumb {...props} apiBase={TEST_API} />;
}

export function LazyVideoPlayer(
  props: Omit<ComponentProps<typeof BaseLazyVideoPlayer>, "apiBase">
) {
  return <BaseLazyVideoPlayer {...props} apiBase={TEST_API} />;
}

export function MessageMediaGallery(
  props: Omit<ComponentProps<typeof BaseMessageMediaGallery>, "apiBase"> & {
    username: string;
    msg: {
      kind: "single" | "album";
      id: number;
      albumSize: number;
      mediaItems: ChannelMediaItem[];
      coverUrl?: string | null;
      mediaStatus?: string | null;
    };
  }
) {
  return <BaseMessageMediaGallery {...props} apiBase={TEST_API} />;
}

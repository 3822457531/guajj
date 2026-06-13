/** GramJS / 极搜 collector 返回结构（与 collector/jisou-search-service.js 对齐） */

export type JisouChannelItem = {
  title: string;
  url: string;
  username: string | null;
  members: string | null;
  /** 极搜链接若指向具体帖子 t.me/channel/12345 */
  postId?: number | null;
  label?: string;
  /** 极搜结果行前缀图标（📢/🎬/🎧/💬） */
  contentIcon?: string;
};

/** 极搜频道结果中 username 为空表示邀请链接推广位（广告） */
export function isJisouPromotedChannel(channel: Pick<JisouChannelItem, "username">): boolean {
  return !channel.username;
}

export type JisouSearchResult = {
  query: string;
  replyMessageId?: number;
  channels: JisouChannelItem[];
  hotKeywords: Array<{ label: string; url: string }>;
  ads: Array<{ label: string; url: string }>;
  buttons: unknown;
  fetchedAt: string;
};

export type MediaItemStatus = "pending" | "thumb_ready" | "ready";

export type ChannelMediaItem = {
  id: number;
  contentType: string;
  thumbUrl?: string | null;
  fullUrl?: string | null;
  status?: MediaItemStatus;
};

export type ChannelMessageItem = {
  kind: "single" | "album";
  id: number;
  ids: number[];
  date: string | null;
  caption?: string;
  /** 完整正文（查看原文用） */
  fullText?: string;
  textPreview: string;
  contentType: string;
  hasMedia: boolean;
  coverUrl?: string | null;
  mediaStatus?: "pending" | "partial" | "thumb_ready" | null;
  mediaItems: ChannelMediaItem[];
  albumSize: number;
  permalink: string;
  /** 极搜定位的目标消息 */
  isAnchor?: boolean;
  /** 命中后台屏蔽关键词，前台马赛克展示 */
  sensitiveBlocked?: boolean;
};

export type ChannelMessagesResult = {
  username: string;
  entityType: string;
  broadcast: boolean | null;
  joinedRequired: boolean;
  search: string | null;
  anchorMessageId?: number | null;
  /** 极搜 postId 直达：仅返回该消息/相册，不含频道列表 */
  resourceOnly?: boolean;
  count: number;
  rawCount: number;
  messages: ChannelMessageItem[];
  fetchedAt: string;
};

export type ResolvedMedia = {
  url: string;
  cached: boolean;
  mime: string;
  contentType: string;
  messageId: number;
  username: string;
  thumb: boolean;
  buffer?: Buffer | null;
};

export type JisouCaptchaChallenge = {
  challengeId: string;
  prompt: string;
  options: string[];
  expiresInSec: number;
  imageUrl: string;
};

export type JisouSearchService = {
  searchJisouChannels: (
    query: string,
    opts?: { webCaptcha?: boolean; signal?: AbortSignal }
  ) => Promise<JisouSearchResult>;
  preemptLowPriorityWork?: (reason?: string) => void;
  solveJisouCaptchaAndSearch: (challengeId: string, answer: string) => Promise<JisouSearchResult>;
  clickJisouSearchButton: (opts: {
    replyMessageId: number;
    callback?: string;
    text?: string;
    query?: string;
    webCaptcha?: boolean;
  }) => Promise<JisouSearchResult>;
  getJisouCaptchaImage: (challengeId: string) => { buffer: Buffer; mime: string } | null;
  fetchChannelMessages: (
    username: string,
    opts: {
      limit?: number;
      search?: string;
      messageId?: number;
      includeContext?: boolean;
      signal?: AbortSignal;
    }
  ) => Promise<ChannelMessagesResult>;
  resolveMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean; signal?: AbortSignal }
  ) => Promise<ResolvedMedia>;
  resolveMessageMediaBatch: (
    username: string,
    messageIds: number[],
    opts?: { thumb?: boolean; signal?: AbortSignal }
  ) => Promise<{ username: string; media: Record<number, { url: string; cached?: boolean }>; partial?: boolean }>;
  getCachedFullMediaUrl: (
    username: string,
    messageId: number
  ) => Promise<{ url: string; contentType: string; messageId: number; username: string } | null>;
  getCachedThumbMediaUrl?: (
    username: string,
    messageId: number
  ) => Promise<{ url: string; contentType: string; messageId: number; username: string } | null>;
  createVideoStreamResponse: (
    username: string,
    messageId: number,
    opts?: { signal?: AbortSignal; rangeHeader?: string | null }
  ) => Promise<
    | { redirect: string; playRoute?: string; playMode?: string; cached?: boolean }
    | {
        stream: ReadableStream<Uint8Array>;
        mime: string;
        fileSize?: number;
        playRoute?: string;
        playMode?: string;
        status?: number;
        contentLength?: number | null;
        contentRange?: string | null;
        cached?: boolean;
      }
  >;
  resolveVideoPlayInfo: (
    username: string,
    messageId: number,
    opts?: { signal?: AbortSignal }
  ) => Promise<{
    username: string;
    messageId: number;
    route: string;
    playMode: string;
    largeFile: boolean;
    warmEligible: boolean;
    cached: boolean;
    url: string | null;
    fileSize: number | null;
    durationSec: number | null;
    warmMaxMb?: number;
    warmEnabled?: boolean;
    mime?: string;
  }>;
  warmVideoMedia: (
    username: string,
    messageId: number,
    opts?: { metrics?: boolean }
  ) => Promise<ResolvedMedia | null>;
  warmVideoMediaBatch?: (
    username: string,
    messageIds: number[],
    opts?: { metrics?: boolean }
  ) => number;
  downloadMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean }
  ) => Promise<ResolvedMedia>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

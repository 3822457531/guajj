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
};

export type ChannelMessagesResult = {
  username: string;
  entityType: string;
  broadcast: boolean | null;
  joinedRequired: boolean;
  note: string;
  search: string | null;
  anchorMessageId?: number | null;
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
  searchJisouChannels: (query: string, opts?: { webCaptcha?: boolean }) => Promise<JisouSearchResult>;
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
    opts: { limit?: number; search?: string; messageId?: number }
  ) => Promise<ChannelMessagesResult>;
  resolveMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean }
  ) => Promise<ResolvedMedia>;
  downloadMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean }
  ) => Promise<ResolvedMedia>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

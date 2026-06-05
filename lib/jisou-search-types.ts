/** GramJS / 极搜 collector 返回结构（与 collector/jisou-search-service.js 对齐） */

export type JisouChannelItem = {
  title: string;
  url: string;
  username: string | null;
  members: string | null;
};

export type JisouSearchResult = {
  query: string;
  replyMessageId?: number;
  channels: JisouChannelItem[];
  hotKeywords: Array<{ label: string; url: string }>;
  ads: Array<{ label: string; url: string }>;
  buttons: unknown;
  fetchedAt: string;
};

export type ChannelMessageItem = {
  kind: "single" | "album";
  id: number;
  ids: number[];
  date: string | null;
  caption?: string;
  textPreview: string;
  contentType: string;
  hasMedia: boolean;
  mediaItems: Array<{ id: number; contentType: string }>;
  albumSize: number;
  permalink: string;
};

export type ChannelMessagesResult = {
  username: string;
  entityType: string;
  broadcast: boolean | null;
  joinedRequired: boolean;
  note: string;
  search: string | null;
  count: number;
  rawCount: number;
  messages: ChannelMessageItem[];
  fetchedAt: string;
};

export type JisouSearchService = {
  searchJisouChannels: (query: string) => Promise<JisouSearchResult>;
  fetchChannelMessages: (
    username: string,
    opts: { limit?: number; search?: string; messageId?: number }
  ) => Promise<ChannelMessagesResult>;
  downloadMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean }
  ) => Promise<{ buffer: Buffer; mime: string; contentType: string }>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

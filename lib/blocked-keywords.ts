import type { Post, TgIndexedMessage } from "@/lib/generated/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import { getSiteSettings } from "@/lib/site-settings";

/** 解析后台保存的屏蔽词（每行一个，也兼容逗号/分号分隔） */
export function parseBlockedKeywords(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const lines = raw.split(/[\r\n]+/).flatMap((line) => line.split(/[,，;；]+/));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of lines) {
    const kw = part.trim();
    if (kw.length < 1) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

export async function getBlockedKeywords(): Promise<string[]> {
  const settings = await getSiteSettings();
  return parseBlockedKeywords(settings.blockedKeywords);
}

export function serializeBlockedKeywords(keywords: string[]): string {
  return parseBlockedKeywords(keywords.join("\n")).join("\n");
}

function haystackIncludesKeyword(haystack: string, keyword: string): boolean {
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

export function indexedMessageIsBlocked(
  item: Pick<TgIndexedMessage, "title" | "snippet" | "rawText">,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const haystack = `${item.title}\n${item.snippet}\n${item.rawText}`;
  return keywords.some((kw) => haystackIncludesKeyword(haystack, kw));
}

export function postIsBlocked(
  post: Pick<Post, "title" | "summary" | "body">,
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const haystack = `${post.title}\n${post.summary}\n${post.body}`;
  return keywords.some((kw) => haystackIncludesKeyword(haystack, kw));
}

export function buildIndexedMessageBlockedExcludeWhere(
  keywords: string[]
): Prisma.TgIndexedMessageWhereInput {
  if (keywords.length === 0) return {};
  return {
    AND: keywords.map((kw) => ({
      NOT: {
        OR: [
          { title: { contains: kw } },
          { snippet: { contains: kw } },
          { rawText: { contains: kw } }
        ]
      }
    }))
  };
}

export function buildPostBlockedExcludeWhere(keywords: string[]): Prisma.PostWhereInput {
  if (keywords.length === 0) return {};
  return {
    AND: keywords.map((kw) => ({
      NOT: {
        OR: [{ title: { contains: kw } }, { summary: { contains: kw } }, { body: { contains: kw } }]
      }
    }))
  };
}

export function mergePrismaWhere<T extends Record<string, unknown>>(
  base: T | undefined,
  extra: T | undefined
): T | undefined {
  const hasBase = base && Object.keys(base).length > 0;
  const hasExtra = extra && Object.keys(extra).length > 0;
  if (!hasBase) return hasExtra ? extra : undefined;
  if (!hasExtra) return base;
  return { AND: [base, extra] } as unknown as T;
}

export function filterIndexedMessagesByBlocked<T extends Pick<TgIndexedMessage, "title" | "snippet" | "rawText">>(
  items: T[],
  keywords: string[]
): T[] {
  if (keywords.length === 0) return items;
  return items.filter((item) => !indexedMessageIsBlocked(item, keywords));
}

/** 暗网频道消息预览：正文/摘要命中屏蔽词 */
export function channelMessageIsBlocked(
  msg: { textPreview?: string | null; fullText?: string | null; caption?: string | null },
  keywords: string[]
): boolean {
  if (keywords.length === 0) return false;
  const haystack = `${msg.textPreview ?? ""}\n${msg.fullText ?? ""}\n${msg.caption ?? ""}`;
  if (!haystack.trim()) return false;
  return keywords.some((kw) => haystackIncludesKeyword(haystack, kw));
}

export function markChannelMessagesSensitive<
  T extends { textPreview?: string | null; fullText?: string | null; caption?: string | null }
>(messages: T[], keywords: string[]): Array<T & { sensitiveBlocked?: boolean }> {
  if (keywords.length === 0) return messages;
  return messages.map((msg) =>
    channelMessageIsBlocked(msg, keywords) ? { ...msg, sensitiveBlocked: true } : msg
  );
}

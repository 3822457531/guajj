import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";

export type IndexChannelOption = {
  chatId: string;
  label: string;
  count: number;
};

export function parseIndexChatFilter(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  const ids = parts.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean);
  return [...new Set(ids)];
}

export function buildIndexMessagesListWhere(
  q: string,
  chatIds: string[]
): Prisma.TgIndexedMessageWhereInput | undefined {
  const parts: Prisma.TgIndexedMessageWhereInput[] = [];
  const trimmed = q.trim();

  if (chatIds.length > 0) {
    parts.push({ chatId: { in: chatIds } });
  }
  if (trimmed) {
    parts.push({
      OR: [
        { title: { contains: trimmed } },
        { snippet: { contains: trimmed } },
        { rawText: { contains: trimmed } },
        { sourceTitle: { contains: trimmed } },
        { sourceUsername: { contains: trimmed } }
      ]
    });
  }

  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}

/** 索引列表频道筛选项：已入库频道 + 采集配置频道（含 0 条） */
export async function getIndexChannelFilterOptions(): Promise<IndexChannelOption[]> {
  const [groups, sources, samples] = await Promise.all([
    prisma.tgIndexedMessage.groupBy({
      by: ["chatId"],
      _count: { _all: true }
    }),
    prisma.tgSourceChannel.findMany({
      where: { chatId: { not: null } },
      orderBy: { title: "asc" }
    }),
    prisma.tgIndexedMessage.findMany({
      distinct: ["chatId"],
      select: { chatId: true, sourceTitle: true, sourceUsername: true }
    })
  ]);

  const countByChat = new Map(groups.map((g) => [g.chatId, g._count._all]));
  const labelByChat = new Map<string, string>();

  for (const s of sources) {
    if (!s.chatId) continue;
    const label = s.title?.trim() || (s.username ? `@${s.username}` : s.chatId);
    labelByChat.set(s.chatId, label);
  }
  for (const row of samples) {
    if (labelByChat.has(row.chatId)) continue;
    const label =
      row.sourceTitle?.trim() ||
      (row.sourceUsername ? `@${row.sourceUsername.replace(/^@/, "")}` : row.chatId);
    labelByChat.set(row.chatId, label);
  }

  const chatIds = new Set<string>([
    ...countByChat.keys(),
    ...sources.map((s) => s.chatId!).filter(Boolean)
  ]);

  return [...chatIds]
    .map((chatId) => ({
      chatId,
      label: labelByChat.get(chatId) ?? chatId,
      count: countByChat.get(chatId) ?? 0
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"));
}

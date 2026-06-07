import { prisma } from "@/lib/prisma";
import { collectIndexMessagesMediaKeysAsync } from "@/lib/index-message-media-keys";
import { deleteMediaObjectKeys } from "@/lib/media-storage";

export type DeleteIndexMessagesResult = {
  deleted: number;
  mediaKeys: number;
  mediaDeleted: number;
  mediaFailed: number;
};

export async function deleteIndexMessagesWithMedia(ids: string[]): Promise<DeleteIndexMessagesResult> {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { deleted: 0, mediaKeys: 0, mediaDeleted: 0, mediaFailed: 0 };
  }

  const items = await prisma.tgIndexedMessage.findMany({
    where: { id: { in: uniqueIds } }
  });

  if (items.length === 0) {
    return { deleted: 0, mediaKeys: 0, mediaDeleted: 0, mediaFailed: 0 };
  }

  const keys = await collectIndexMessagesMediaKeysAsync(items);
  const mediaResults = keys.length > 0 ? await deleteMediaObjectKeys(keys) : [];
  const mediaDeleted = mediaResults.filter((r) => r.ok).length;
  const mediaFailed = mediaResults.filter((r) => !r.ok).length;

  if (mediaFailed > 0) {
    console.warn(
      "[delete-index-messages] some media objects failed to delete",
      mediaResults.filter((r) => !r.ok)
    );
  }

  const result = await prisma.tgIndexedMessage.deleteMany({
    where: { id: { in: items.map((item) => item.id) } }
  });

  return {
    deleted: result.count,
    mediaKeys: keys.length,
    mediaDeleted,
    mediaFailed
  };
}

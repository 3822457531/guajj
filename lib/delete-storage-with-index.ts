import { prisma } from "@/lib/prisma";
import { deleteIndexMessagesWithMedia } from "@/lib/delete-index-messages";
import { deleteMediaObjectKeys, normalizeObjectKey, type DeleteMediaResult } from "@/lib/media-storage";
import { classifyStorageCategory } from "@/lib/storage-stats-shared";

export type DeleteStorageWithIndexResult = {
  mediaResults: DeleteMediaResult[];
  mediaDeleted: number;
  mediaFailed: number;
  indexDeleted: number;
  indexMediaDeleted: number;
  homeIndexKeys: number;
  searchKeys: number;
  otherKeys: number;
};

function keySearchNeedles(key: string): string[] {
  const normalized = key.replace(/^\/+/, "");
  const needles = new Set<string>([normalized, `/${normalized}`]);
  const base = normalized.split("/").pop();
  if (base && base.length >= 12) needles.add(base);
  return [...needles];
}

/** 根据 OSS Key 查找关联的首页索引消息 ID（硬删用） */
export async function findIndexMessageIdsByMediaKeys(keys: string[]): Promise<string[]> {
  const indexKeys = [...new Set(keys.map((k) => normalizeObjectKey(k)).filter(Boolean) as string[])].filter(
    (k) => classifyStorageCategory(k) === "home_index"
  );
  if (indexKeys.length === 0) return [];

  const idSet = new Set<string>();
  const chunkSize = 20;
  for (let i = 0; i < indexKeys.length; i += chunkSize) {
    const chunk = indexKeys.slice(i, i + chunkSize);
    const or = chunk.flatMap((key) =>
      keySearchNeedles(key).flatMap((needle) => [
        { mediaUrl: { contains: needle } },
        { galleryImageUrls: { contains: needle } },
        { galleryVideoUrls: { contains: needle } },
        { contentBlocks: { contains: needle } }
      ])
    );

    const rows = await prisma.tgIndexedMessage.findMany({
      where: { OR: or },
      select: { id: true }
    });
    for (const row of rows) idSet.add(row.id);
  }

  return [...idSet];
}

/**
 * 删除存储对象。
 * - 首页索引（uploads/tg-index/）：同步硬删除关联 TgIndexedMessage 及其全部媒体
 * - 用户搜索 / 其他：仅删除 OSS/本地对象
 */
export async function deleteStorageObjectsWithIndex(keys: string[]): Promise<DeleteStorageWithIndexResult> {
  const unique = [...new Set(keys.map((k) => normalizeObjectKey(k)).filter(Boolean) as string[])];

  let homeIndexKeys = 0;
  let searchKeys = 0;
  let otherKeys = 0;
  for (const key of unique) {
    const cat = classifyStorageCategory(key);
    if (cat === "home_index") homeIndexKeys++;
    else if (cat === "user_search") searchKeys++;
    else otherKeys++;
  }

  if (unique.length === 0) {
    return {
      mediaResults: [],
      mediaDeleted: 0,
      mediaFailed: 0,
      indexDeleted: 0,
      indexMediaDeleted: 0,
      homeIndexKeys,
      searchKeys,
      otherKeys
    };
  }

  const indexIds = await findIndexMessageIdsByMediaKeys(unique);
  let indexDeleted = 0;
  let indexMediaDeleted = 0;

  if (indexIds.length > 0) {
    const indexResult = await deleteIndexMessagesWithMedia(indexIds);
    indexDeleted = indexResult.deleted;
    indexMediaDeleted = indexResult.mediaDeleted;
  }

  // 幂等删除选中对象（含首页 orphan、搜索资源、以及索引流程已删过的文件）
  const mediaResults = await deleteMediaObjectKeys(unique);
  const mediaDeleted = mediaResults.filter((r) => r.ok).length;
  const mediaFailed = mediaResults.filter((r) => !r.ok).length;

  return {
    mediaResults,
    mediaDeleted,
    mediaFailed,
    indexDeleted,
    indexMediaDeleted,
    homeIndexKeys,
    searchKeys,
    otherKeys
  };
}

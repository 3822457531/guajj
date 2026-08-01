/** 客户端/服务端均可安全引用的存储统计类型与工具（不含 fs / R2） */

export type MediaKind = "image" | "video" | "other";

/** 存储资源业务分类 */
export type StorageCategory = "home_index" | "user_search" | "telegram" | "other";

export type StorageSort = "date_desc" | "date_asc" | "size_desc" | "size_asc" | "key_asc";

export type StorageObjectRow = {
  key: string;
  size: number;
  lastModified?: Date | string;
  kind: MediaKind;
  category: StorageCategory;
};

export const STORAGE_CATEGORY_LABEL: Record<StorageCategory, string> = {
  home_index: "首页索引",
  user_search: "用户搜索",
  telegram: "Telegram",
  other: "其他"
};

export function classifyStorageCategory(key: string): StorageCategory {
  const normalized = key.replace(/^\/+/, "");
  if (normalized.startsWith("uploads/tg-index/")) return "home_index";
  if (normalized.startsWith("uploads/tg-search/")) return "user_search";
  if (normalized.startsWith("uploads/telegram/")) return "telegram";
  return "other";
}

export function sortStorageObjects(rows: StorageObjectRow[], sort: StorageSort): StorageObjectRow[] {
  const list = [...rows];
  const time = (row: StorageObjectRow) => {
    if (!row.lastModified) return 0;
    const t = new Date(row.lastModified).getTime();
    return Number.isFinite(t) ? t : 0;
  };
  switch (sort) {
    case "date_asc":
      return list.sort((a, b) => time(a) - time(b) || a.key.localeCompare(b.key));
    case "size_desc":
      return list.sort((a, b) => b.size - a.size || a.key.localeCompare(b.key));
    case "size_asc":
      return list.sort((a, b) => a.size - b.size || a.key.localeCompare(b.key));
    case "key_asc":
      return list.sort((a, b) => a.key.localeCompare(b.key));
    case "date_desc":
    default:
      return list.sort((a, b) => time(b) - time(a) || a.key.localeCompare(b.key));
  }
}

export type StorageStats = {
  imageCount: number;
  videoCount: number;
  otherCount: number;
  totalCount: number;
  totalBytes: number;
  prefixBreakdown: { prefix: string; count: number; bytes: number }[];
  largestFiles: StorageObjectRow[];
};

export type StorageScanResult = {
  ok: boolean;
  error?: string;
  stats: StorageStats | null;
  scannedAt: Date;
};

export type StorageMonitorReport = {
  activeStorage: "r2" | "local";
  r2Ready: boolean;
  bucketName: string | null;
  publicBaseUrl: string | null;
  r2: StorageScanResult | null;
  local: StorageScanResult;
  scannedAt: Date;
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i === 0 ? 0 : n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return `${n.toFixed(digits)} ${units[i]}`;
}

/** 客户端/服务端均可安全引用的存储统计类型与工具（不含 fs / R2） */

export type MediaKind = "image" | "video" | "other";

export type StorageObjectRow = {
  key: string;
  size: number;
  lastModified?: Date;
  kind: MediaKind;
};

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

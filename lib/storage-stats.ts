import { ListObjectsV2Command, type _Object } from "@aws-sdk/client-s3";
import type { Dirent } from "fs";
import { readdir, stat } from "fs/promises";
import path from "path";
import { createR2Client, isR2Ready } from "@/lib/media-storage";
import { getSiteSettings } from "@/lib/site-settings";
import type { MediaKind, StorageObjectRow, StorageScanResult, StorageStats, StorageMonitorReport } from "@/lib/storage-stats-shared";

export type {
  MediaKind,
  StorageObjectRow,
  StorageStats,
  StorageScanResult,
  StorageMonitorReport
} from "@/lib/storage-stats-shared";
export { formatBytes } from "@/lib/storage-stats-shared";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg", "heic", "heif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v", "mpeg", "mpg", "3gp"]);

function extOf(keyOrPath: string): string {
  const base = keyOrPath.split("?")[0] ?? keyOrPath;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function classifyMediaKind(keyOrPath: string, contentType?: string): MediaKind {
  const ct = (contentType ?? "").toLowerCase();
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";

  const ext = extOf(keyOrPath);
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "other";
}

function prefixGroup(key: string): string {
  const normalized = key.replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/")) return normalized.includes("/") ? normalized.split("/")[0] + "/" : "(根目录)";
  const rest = normalized.slice("uploads/".length);
  const seg = rest.split("/")[0];
  return seg ? `uploads/${seg}/` : "uploads/";
}

function emptyStats(): StorageStats {
  return {
    imageCount: 0,
    videoCount: 0,
    otherCount: 0,
    totalCount: 0,
    totalBytes: 0,
    prefixBreakdown: [],
    largestFiles: []
  };
}

function aggregateObjects(rows: StorageObjectRow[]): StorageStats {
  const stats = emptyStats();
  const prefixMap = new Map<string, { count: number; bytes: number }>();

  for (const row of rows) {
    stats.totalCount++;
    stats.totalBytes += row.size;
    if (row.kind === "image") stats.imageCount++;
    else if (row.kind === "video") stats.videoCount++;
    else stats.otherCount++;

    const prefix = prefixGroup(row.key);
    const prev = prefixMap.get(prefix) ?? { count: 0, bytes: 0 };
    prev.count++;
    prev.bytes += row.size;
    prefixMap.set(prefix, prev);
  }

  stats.prefixBreakdown = [...prefixMap.entries()]
    .map(([prefix, v]) => ({ prefix, count: v.count, bytes: v.bytes }))
    .sort((a, b) => b.bytes - a.bytes);

  stats.largestFiles = [...rows].sort((a, b) => b.size - a.size).slice(0, 15);
  return stats;
}

function objectRow(obj: _Object): StorageObjectRow | null {
  const key = obj.Key;
  if (!key || key.endsWith("/")) return null;
  const size = obj.Size ?? 0;
  return {
    key,
    size,
    lastModified: obj.LastModified,
    kind: classifyMediaKind(key)
  };
}

export async function scanR2Bucket(prefix = "uploads/"): Promise<StorageScanResult> {
  const scannedAt = new Date();
  const settings = await getSiteSettings();

  if (!isR2Ready(settings)) {
    return { ok: false, error: "R2 未配置完整（请在「设置」中填写桶名、公网前缀与密钥）", stats: null, scannedAt };
  }

  const client = createR2Client(settings);
  const bucket = settings.r2BucketName!.trim();
  if (!client) {
    return { ok: false, error: "缺少 R2 访问密钥", stats: null, scannedAt };
  }

  try {
    const rows = await listR2ObjectRows(client, bucket, prefix);
    return { ok: true, stats: aggregateObjects(rows), scannedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, stats: null, scannedAt };
  }
}

async function listR2ObjectRows(
  client: ReturnType<typeof createR2Client>,
  bucket: string,
  prefix: string,
  limit?: number
): Promise<StorageObjectRow[]> {
  if (!client) return [];
  const rows: StorageObjectRow[] = [];
  let continuationToken: string | undefined;

  do {
    const out = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken
      })
    );
    for (const obj of out.Contents ?? []) {
      const row = objectRow(obj);
      if (row) rows.push(row);
      if (limit && rows.length >= limit) return rows.slice(0, limit);
    }
    continuationToken = out.IsTruncated ? out.NextContinuationToken : undefined;
  } while (continuationToken && (!limit || rows.length < limit));

  return limit ? rows.slice(0, limit) : rows;
}

/** 按前缀列出 R2 或本地文件（后台删除用） */
export async function listStorageObjects(prefix = "uploads/", limit = 200): Promise<StorageObjectRow[]> {
  const settings = await getSiteSettings();
  const safePrefix = prefix.startsWith("uploads/") ? prefix : `uploads/${prefix.replace(/^\/+/, "")}`;

  if (isR2Ready(settings)) {
    const client = createR2Client(settings);
    const bucket = settings.r2BucketName!.trim();
    if (client && bucket) {
      try {
        return await listR2ObjectRows(client, bucket, safePrefix, limit);
      } catch {
        /* fall through to local */
      }
    }
  }

  const allLocal = await walkLocalUploads(path.join(process.cwd(), "public", "uploads"));
  return allLocal.filter((row) => row.key.startsWith(safePrefix)).slice(0, limit);
}

async function walkLocalUploads(dir: string, baseKey = "uploads"): Promise<StorageObjectRow[]> {
  const rows: StorageObjectRow[] = [];
  let entries: Dirent[];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return rows;
    throw e;
  }

  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      rows.push(...(await walkLocalUploads(full, `${baseKey}/${ent.name}`)));
      continue;
    }
    if (!ent.isFile()) continue;
    const st = await stat(full);
    const key = `${baseKey}/${ent.name}`.replace(/\\/g, "/");
    rows.push({
      key,
      size: st.size,
      lastModified: st.mtime,
      kind: classifyMediaKind(key)
    });
  }
  return rows;
}

export async function scanLocalUploadsDir(): Promise<StorageScanResult> {
  const scannedAt = new Date();
  const root = path.join(process.cwd(), "public", "uploads");
  try {
    const rows = await walkLocalUploads(root);
    return { ok: true, stats: aggregateObjects(rows), scannedAt };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, stats: null, scannedAt };
  }
}

/** 后台存储监控：按当前配置扫描 R2 与本地 uploads */
export async function getStorageMonitorReport(): Promise<StorageMonitorReport> {
  const settings = await getSiteSettings();
  const activeStorage = settings.mediaStorage === "r2" ? "r2" : "local";
  const r2Ready = isR2Ready(settings);

  const [r2, local] = await Promise.all([
    r2Ready ? scanR2Bucket("uploads/") : Promise.resolve(null),
    scanLocalUploadsDir()
  ]);

  const scannedAt = new Date(
    Math.max(
      local.scannedAt.getTime(),
      r2?.scannedAt.getTime() ?? 0,
      Date.now()
    )
  );

  return {
    activeStorage,
    r2Ready,
    bucketName: settings.r2BucketName?.trim() || null,
    publicBaseUrl: settings.r2PublicBaseUrl?.trim() || null,
    r2,
    local,
    scannedAt
  };
}

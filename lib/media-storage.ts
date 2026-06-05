import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { SiteSettings } from "@/lib/generated/prisma";
import { getSiteSettings } from "@/lib/site-settings";

const R2_REGION = "auto";

function trimBaseUrl(base: string): string {
  return base.replace(/\/+$/, "");
}

function buildObjectKey(subPath: string): string {
  const clean = subPath.replace(/^\/+/, "").replace(/\\/g, "/");
  return `uploads/${clean}`;
}

function publicUrlForKey(settings: SiteSettings, key: string): string {
  const base = trimBaseUrl(settings.r2PublicBaseUrl!.trim());
  return `${base}/${key}`;
}

function resolveR2Credentials(settings: SiteSettings): { accessKeyId: string; secretAccessKey: string } | null {
  const accessKeyId =
    process.env.R2_ACCESS_KEY_ID?.trim() || settings.r2AccessKeyId?.trim() || "";
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY?.trim() || settings.r2SecretAccessKey?.trim() || "";
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

function resolveR2AccountId(settings: SiteSettings): string | null {
  return process.env.R2_ACCOUNT_ID?.trim() || settings.r2AccountId?.trim() || null;
}

/** 是否启用 R2：后台选择 r2 且账号、桶、公网前缀与密钥齐全 */
export function isR2Ready(settings: SiteSettings): boolean {
  if (settings.mediaStorage !== "r2") return false;
  const accountId = resolveR2AccountId(settings);
  const bucket = settings.r2BucketName?.trim();
  const pub = settings.r2PublicBaseUrl?.trim();
  if (!accountId || !bucket || !pub) return false;
  if (!resolveR2Credentials(settings)) return false;
  return true;
}

export function createR2Client(settings: SiteSettings): S3Client | null {
  const accountId = resolveR2AccountId(settings);
  const creds = resolveR2Credentials(settings);
  if (!accountId || !creds) return null;
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  return new S3Client({
    region: R2_REGION,
    endpoint,
    credentials: creds,
    forcePathStyle: false
  });
}

export type SaveMediaBytesInput = {
  buffer: Buffer;
  /** 相对 uploads 的路径，如 `telegram/xxx.mp4` 或 `photo.jpg` */
  subPath: string;
  contentType?: string;
};

/**
 * 写入本地 `public/uploads/...` 或上传到 R2，返回写入稿件用的 URL（绝对外链或站内路径）。
 * 若选了 R2 但未配置完整，回退本地并打日志。
 */
export async function saveMediaBytes(input: SaveMediaBytesInput): Promise<{ url: string; storage: "local" | "r2" }> {
  const settings = await getSiteSettings();
  const key = buildObjectKey(input.subPath);

  if (isR2Ready(settings)) {
    const client = createR2Client(settings);
    const bucket = settings.r2BucketName!.trim();
    if (!client) {
      console.warn("[media-storage] R2 credentials missing; falling back to local");
    } else {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: input.buffer,
            ContentType: input.contentType || "application/octet-stream"
          })
        );
        return { url: publicUrlForKey(settings, key), storage: "r2" };
      } catch (e) {
        console.error("[media-storage] R2 PutObject failed, falling back to local", e);
      }
    }
  }

  const dir = path.join(process.cwd(), "public", path.dirname(key));
  await mkdir(dir, { recursive: true });
  const fsPath = path.join(process.cwd(), "public", key);
  await writeFile(fsPath, input.buffer);
  return { url: `/${key}`, storage: "local" };
}

/**
 * 采集端保存媒体（与 lib/media-storage.ts 逻辑一致，CommonJS）
 * 高并发预缓存时复用 DB 配置与 S3 客户端，避免每张图新建连接。
 */
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream/promises");
const { PassThrough } = require("stream");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { createPrisma } = require("../lib/tg-index-ingest");

const R2_REGION = "auto";
const SITE_SETTINGS_ID = "main";
const SETTINGS_CACHE_MS = Math.max(
  5000,
  Number(process.env.TG_MEDIA_SETTINGS_CACHE_MS) || 60000
);

/** @type {{ settings: object|null, at: number, s3: import('@aws-sdk/client-s3').S3Client|null, s3Key: string|null }} */
const runtime = { settings: null, at: 0, s3: null, s3Key: null };

function trimBaseUrl(base) {
  return base.replace(/\/+$/, "");
}

function buildObjectKey(subPath) {
  return `uploads/${subPath.replace(/^\/+/, "").replace(/\\/g, "/")}`;
}

function resolveR2Credentials(settings) {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || settings.r2AccessKeyId?.trim() || "";
  const secretAccessKey =
    process.env.R2_SECRET_ACCESS_KEY?.trim() || settings.r2SecretAccessKey?.trim() || "";
  if (!accessKeyId || !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}

function isR2Ready(settings) {
  if (settings.mediaStorage !== "r2") return false;
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || settings.r2AccountId?.trim();
  const bucket = settings.r2BucketName?.trim();
  const pub = settings.r2PublicBaseUrl?.trim();
  if (!accountId || !bucket || !pub) return false;
  return Boolean(resolveR2Credentials(settings));
}

async function loadSiteSettingsFresh() {
  const prisma = createPrisma();
  try {
    return await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: { id: SITE_SETTINGS_ID },
      update: {}
    });
  } finally {
    await prisma.$disconnect();
  }
}

async function getSiteSettingsCached() {
  const now = Date.now();
  if (runtime.settings && now - runtime.at < SETTINGS_CACHE_MS) {
    return runtime.settings;
  }
  const settings = await loadSiteSettingsFresh();
  runtime.settings = settings;
  runtime.at = now;
  runtime.s3 = null;
  runtime.s3Key = null;
  return settings;
}

function getR2Client(settings) {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || settings.r2AccountId.trim();
  const creds = resolveR2Credentials(settings);
  const bucket = settings.r2BucketName.trim();
  const cacheKey = `${accountId}:${bucket}:${creds?.accessKeyId || ""}`;
  if (runtime.s3 && runtime.s3Key === cacheKey) {
    return { client: runtime.s3, bucket, accountId, creds };
  }
  const client = new S3Client({
    region: R2_REGION,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: creds,
    forcePathStyle: false,
    maxAttempts: 3
  });
  runtime.s3 = client;
  runtime.s3Key = cacheKey;
  return { client, bucket, accountId, creds };
}

function r2MultipartPartSize() {
  const mb = Number(process.env.R2_MULTIPART_PART_SIZE_MB) || 8;
  return Math.min(32, Math.max(5, Math.round(mb))) * 1024 * 1024;
}

function r2MultipartQueueSize() {
  return Math.min(8, Math.max(2, Number(process.env.R2_MULTIPART_QUEUE_SIZE) || 4));
}

/**
 * 流式写入 R2（multipart）或本地文件，适合大视频边下边传
 * @param {import('stream').Readable} readable
 * @returns {Promise<string>}
 */
async function saveMediaStream(readable, subPath, contentType) {
  const settings = await getSiteSettingsCached();
  const key = buildObjectKey(subPath);

  if (isR2Ready(settings)) {
    const { client, bucket } = getR2Client(settings);
    try {
      const upload = new Upload({
        client,
        params: {
          Bucket: bucket,
          Key: key,
          Body: readable,
          ContentType: contentType || "application/octet-stream"
        },
        queueSize: r2MultipartQueueSize(),
        partSize: r2MultipartPartSize(),
        leavePartsOnError: false
      });
      await upload.done();
      const base = trimBaseUrl(settings.r2PublicBaseUrl.trim());
      return `${base}/${key}`;
    } catch (e) {
      console.warn("[collector/save-media] R2 stream 失败，回退本地:", e.message);
    }
  }

  const fsPath = path.join(process.cwd(), "public", key);
  const partPath = `${fsPath}.part`;
  fs.mkdirSync(path.dirname(fsPath), { recursive: true });
  try {
    await pipeline(readable, fs.createWriteStream(partPath));
    if (fs.existsSync(fsPath)) fs.unlinkSync(fsPath);
    fs.renameSync(partPath, fsPath);
    return `/${key}`;
  } catch (e) {
    try {
      if (fs.existsSync(partPath)) fs.unlinkSync(partPath);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

/**
 * 将 async iterable chunks 流式写入 R2/本地（Worker / 视频缓存用）
 * @param {AsyncIterable<Buffer|Uint8Array>} chunkIter
 * @returns {Promise<string>}
 */
async function saveMediaFromChunkIter(chunkIter, subPath, contentType) {
  const pass = new PassThrough();
  const uploadPromise = saveMediaStream(pass, subPath, contentType);

  void (async () => {
    try {
      for await (const chunk of chunkIter) {
        if (!pass.write(chunk)) {
          await new Promise((resolve) => pass.once("drain", resolve));
        }
      }
      pass.end();
    } catch (err) {
      pass.destroy(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return uploadPromise;
}

async function saveMediaBytes(buffer, subPath, contentType) {
  const settings = await getSiteSettingsCached();
  const key = buildObjectKey(subPath);

  if (isR2Ready(settings)) {
    const { client, bucket } = getR2Client(settings);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType || "application/octet-stream"
        })
      );
      const base = trimBaseUrl(settings.r2PublicBaseUrl.trim());
      return `${base}/${key}`;
    } catch (e) {
      console.warn("[collector/save-media] R2 失败，回退本地:", e.message);
    }
  }

  const fsPath = path.join(process.cwd(), "public", key);
  fs.mkdirSync(path.dirname(fsPath), { recursive: true });
  fs.writeFileSync(fsPath, buffer);
  return `/${key}`;
}

module.exports = {
  saveMediaBytes,
  saveMediaStream,
  saveMediaFromChunkIter,
  getSiteSettingsCached,
  isR2Ready,
  buildObjectKey,
  trimBaseUrl,
  resolveR2Credentials,
  getR2Client
};

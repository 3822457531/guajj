/**
 * 采集端保存媒体（与 lib/media-storage.ts 逻辑一致，CommonJS）
 */
const fs = require("fs");
const path = require("path");
const { PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { createPrisma } = require("../lib/tg-index-ingest");

const R2_REGION = "auto";
const SITE_SETTINGS_ID = "main";

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

async function saveMediaBytes(buffer, subPath, contentType) {
  const prisma = createPrisma();
  try {
    const settings = await prisma.siteSettings.upsert({
      where: { id: SITE_SETTINGS_ID },
      create: { id: SITE_SETTINGS_ID },
      update: {}
    });
    const key = buildObjectKey(subPath);

    if (isR2Ready(settings)) {
      const accountId = process.env.R2_ACCOUNT_ID?.trim() || settings.r2AccountId.trim();
      const creds = resolveR2Credentials(settings);
      const client = new S3Client({
        region: R2_REGION,
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: creds,
        forcePathStyle: false
      });
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: settings.r2BucketName.trim(),
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
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { saveMediaBytes };

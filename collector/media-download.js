const path = require("path");
const { saveMediaBytes } = require("./save-media");

function isMediaDownloadEnabled() {
  const v = (process.env.TG_DOWNLOAD_MEDIA || "1").trim().toLowerCase();
  return v !== "0" && v !== "false" && v !== "no";
}

function shouldDownload(contentType) {
  return contentType === "PHOTO" || contentType === "VIDEO";
}

function mediaDownloadTimeoutMs() {
  const n = Number(process.env.TG_MEDIA_DOWNLOAD_TIMEOUT_MS || 90000);
  if (!Number.isFinite(n) || n <= 0) return 90000;
  return Math.round(n);
}

function extForMessage(msg, contentType) {
  const media = msg.media;
  if (contentType === "VIDEO") {
    const mime = media?.document?.mimeType || "";
    if (mime.includes("webm")) return ".webm";
    if (mime.includes("quicktime") || mime.includes("mov")) return ".mov";
    return ".mp4";
  }
  if (contentType === "PHOTO") return ".jpg";
  const name = media?.document?.attributes?.find?.((a) => a.fileName)?.fileName;
  if (name && path.extname(name)) return path.extname(name);
  return ".bin";
}

function contentTypeFor(contentType, ext) {
  if (contentType === "VIDEO") {
    if (ext === ".webm") return "video/webm";
    if (ext === ".mov") return "video/quicktime";
    return "video/mp4";
  }
  if (contentType === "PHOTO") return "image/jpeg";
  return "application/octet-stream";
}

/**
 * 从 TG 拉取媒体并写入本地/R2，返回可给前端的 URL
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.Message} msg
 * @param {{ chatId: string; messageId: number; contentType: string }} meta
 */
async function downloadIndexedMedia(client, msg, meta) {
  if (!isMediaDownloadEnabled() || !shouldDownload(meta.contentType) || !msg?.media) {
    return null;
  }

  try {
    const timeoutMs = mediaDownloadTimeoutMs();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`下载超时(${timeoutMs}ms)`)), timeoutMs);
    });
    const buffer = await Promise.race([client.downloadMedia(msg, {}), timeoutPromise]);
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      return null;
    }

    const ext = extForMessage(msg, meta.contentType);
    const subPath = `tg-index/${meta.chatId.replace(/^-100/, "")}/${meta.messageId}${ext}`;
    const url = await saveMediaBytes(buffer, subPath, contentTypeFor(meta.contentType, ext));
    return url;
  } catch (err) {
    console.warn(`[媒体] 下载失败 ${meta.chatId}/${meta.messageId}: ${err.message}`);
    return null;
  }
}

/**
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.Message} msg
 * @param {object} payload messageToIndexPayload 结果
 * @param {string} chatId
 */
async function attachMediaUrl(client, msg, payload, chatId) {
  const mediaUrl = await downloadIndexedMedia(client, msg, {
    chatId,
    messageId: payload.messageId,
    contentType: payload.contentType
  });
  if (mediaUrl) payload.mediaUrl = mediaUrl;
  return payload;
}

module.exports = {
  isMediaDownloadEnabled,
  downloadIndexedMedia,
  attachMediaUrl,
  shouldDownload,
  mediaDownloadTimeoutMs
};

/**
 * TG 搜索测试页媒体缓存：R2 / 本地写穿 + 读缓存
 */
const fs = require("fs");
const path = require("path");
const { HeadObjectCommand } = require("@aws-sdk/client-s3");
const { saveMediaBytes, getSiteSettingsCached, isR2Ready, buildObjectKey, trimBaseUrl, getR2Client } = require("./save-media");

const inflight = new Map();

function mediaDownloadTimeoutMs() {
  const n = Number(process.env.TG_SEARCH_MEDIA_DOWNLOAD_TIMEOUT_MS) || 20000;
  return Math.min(60000, Math.max(5000, Math.round(n)));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

/**
 * @param {string} username
 * @param {number} messageId
 * @param {"thumb"|"full"} variant
 * @param {"PHOTO"|"VIDEO"} contentType
 */
function buildMediaSubPath(username, messageId, variant, contentType) {
  const safeUser = String(username).replace(/[^A-Za-z0-9_]/g, "_");
  const mid = Math.floor(Number(messageId));
  if (variant === "thumb") {
    return `tg-search/${safeUser}/${mid}-thumb.jpg`;
  }
  if (contentType === "VIDEO") {
    return `tg-search/${safeUser}/${mid}.mp4`;
  }
  return `tg-search/${safeUser}/${mid}.jpg`;
}

function localFsPath(subPath) {
  return path.join(process.cwd(), "public", buildObjectKey(subPath));
}

function publicUrlForKey(settings, key, isR2) {
  if (isR2) {
    return `${trimBaseUrl(settings.r2PublicBaseUrl.trim())}/${key}`;
  }
  return `/${key}`;
}

/**
 * @returns {Promise<string|null>}
 */
async function getCachedMediaUrl(subPath) {
  const key = buildObjectKey(subPath);
  const localPath = localFsPath(subPath);
  if (fs.existsSync(localPath)) {
    return `/${key}`;
  }

  const settings = await getSiteSettingsCached();
  if (!isR2Ready(settings)) return null;

  const { client, bucket } = getR2Client(settings);

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return publicUrlForKey(settings, key, true);
  } catch {
    return null;
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} subPath
 * @param {string} contentType
 * @returns {Promise<string>}
 */
async function putCachedMedia(buffer, subPath, contentType) {
  return saveMediaBytes(buffer, subPath, contentType);
}

/**
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
function singleflight(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const promise = fn().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/**
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.Message} msg
 * @param {boolean} wantThumb
 * @param {AbortSignal} [signal]
 */
async function downloadMediaBuffer(client, msg, wantThumb, signal) {
  throwIfAborted(signal);
  const { pickContentType } = require("./parse");
  const contentType = pickContentType(msg);
  const downloadOpts = wantThumb ? { thumb: 1 } : {};
  const timeoutMs = mediaDownloadTimeoutMs();

  let timer;
  const downloadPromise = client.downloadMedia(msg, downloadOpts);
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`媒体下载超时（${timeoutMs}ms）`);
      err.code = "DOWNLOAD_TIMEOUT";
      reject(err);
    }, timeoutMs);
  });

  let buffer;
  try {
    buffer = await Promise.race([downloadPromise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }

  throwIfAborted(signal);

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("媒体下载失败");
    err.code = "DOWNLOAD_FAILED";
    throw err;
  }

  let mime = "application/octet-stream";
  if (wantThumb) {
    mime = "image/jpeg";
  } else if (contentType === "PHOTO") {
    mime = "image/jpeg";
  } else if (contentType === "VIDEO") {
    const docMime = msg.media?.document?.mimeType || "";
    mime = docMime.startsWith("video/") ? docMime : "video/mp4";
  }

  return { buffer, mime, contentType };
}

/**
 * @param {import('telegram').TelegramClient} client
 * @param {string} username
 * @param {import('telegram').Api.Message} msg
 * @param {{ thumb?: boolean, signal?: AbortSignal }} opts
 */
async function cacheMessageMediaWithClient(client, username, msg, opts = {}) {
  const { pickContentType } = require("./parse");
  const contentType = pickContentType(msg);
  if (contentType !== "PHOTO" && contentType !== "VIDEO") {
    const err = new Error("不支持的媒体类型");
    err.code = "UNSUPPORTED_MEDIA";
    throw err;
  }

  const wantThumb =
    opts.thumb === true ? true : opts.thumb === false ? false : contentType === "PHOTO";
  const variant = wantThumb ? "thumb" : "full";
  const subPath = buildMediaSubPath(username, msg.id, variant, contentType);
  const flightKey = `cache:${subPath}`;

  return singleflight(flightKey, async () => {
    throwIfAborted(opts.signal);
    const cachedUrl = await getCachedMediaUrl(subPath);
    if (cachedUrl) {
      return {
        url: cachedUrl,
        cached: true,
        contentType,
        variant,
        messageId: msg.id,
        username
      };
    }

    const { buffer, mime } = await downloadMediaBuffer(client, msg, wantThumb, opts.signal);
    const url = await putCachedMedia(buffer, subPath, mime);
    console.log(
      `[tg-search:collector] cached media ${variant} ${username}/${msg.id} → ${url.slice(0, 80)}`
    );
    return {
      url,
      cached: false,
      contentType,
      variant,
      messageId: msg.id,
      username,
      buffer,
      mime
    };
  });
}

/**
 * 并发限制 map
 * @template T,R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} fn
 * @param {AbortSignal} [signal]
 */
async function mapPool(items, concurrency, fn, signal) {
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      if (signal?.aborted) break;
      const index = cursor++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        if (signal?.aborted || err?.code === "REQUEST_ABORTED") break;
        throw err;
      }
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }

  return results;
}

module.exports = {
  buildMediaSubPath,
  getCachedMediaUrl,
  putCachedMedia,
  singleflight,
  downloadMediaBuffer,
  cacheMessageMediaWithClient,
  mapPool
};

/**
 * TG 搜索测试页媒体缓存：R2 / 本地写穿 + 读缓存
 */
const fs = require("fs");
const path = require("path");
const { HeadObjectCommand } = require("@aws-sdk/client-s3");
const { saveMediaBytes, getSiteSettingsCached, isR2Ready, buildObjectKey, trimBaseUrl, getR2Client } = require("./save-media");
const { MediaTransferMetrics, extractMediaMeta } = require("./tg-search-media-metrics");

const inflight = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 视频 document 封面：thumb:1 常越界（仅 1 张封面时），需按 type 或 index 0 */
function pickDocumentThumbCandidates(msg) {
  const thumbs = msg.media?.document?.thumbs;
  if (!Array.isArray(thumbs) || !thumbs.length) return [0];

  const candidates = [];
  for (const type of ["m", "s", "i", "a", "0"]) {
    if (thumbs.some((t) => t && typeof t === "object" && "type" in t && t.type === type)) {
      candidates.push(type);
    }
  }
  candidates.push(0);
  if (thumbs.length > 1) candidates.push(1);
  return [...new Set(candidates)];
}

function buildThumbDownloadOpts(contentType, thumbArg) {
  if (contentType === "VIDEO") {
    return { thumb: thumbArg ?? 0 };
  }
  return { thumb: thumbArg ?? 1 };
}

function mediaDownloadTimeoutMs() {
  const n = Number(process.env.TG_SEARCH_MEDIA_DOWNLOAD_TIMEOUT_MS) || 90000;
  return Math.min(300000, Math.max(4000, Math.round(n)));
}

function videoDownloadTimeoutMs() {
  const video = Number(process.env.TG_SEARCH_VIDEO_DOWNLOAD_TIMEOUT_MS);
  if (Number.isFinite(video) && video > 0) {
    return Math.min(600000, Math.max(10000, Math.round(video)));
  }
  return mediaDownloadTimeoutMs();
}

function mediaDownloadRetries() {
  return Math.min(2, Math.max(0, Number(process.env.TG_SEARCH_MEDIA_DOWNLOAD_RETRIES) || 1));
}

function mediaBatchBudgetMs() {
  const n = Number(process.env.TG_SEARCH_MEDIA_BATCH_BUDGET_MS) || 18000;
  return Math.min(45000, Math.max(5000, Math.round(n)));
}

function mediaBatchMaxIds() {
  return Math.min(24, Math.max(1, Number(process.env.TG_SEARCH_MEDIA_BATCH_MAX) || 12));
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

function localPartPath(subPath) {
  return `${localFsPath(subPath)}.part`;
}

function minCachedBytes(subPath) {
  if (subPath.includes("-thumb.")) return 256;
  if (/\.mp4$/i.test(subPath)) return 65536;
  return 512;
}

function isLikelyValidMediaFile(localPath, subPath) {
  try {
    const stat = fs.statSync(localPath);
    if (!stat.isFile() || stat.size < minCachedBytes(subPath)) return false;
    if (/\.mp4$/i.test(subPath)) {
      const fd = fs.openSync(localPath, "r");
      const head = Buffer.alloc(Math.min(32, stat.size));
      fs.readSync(fd, head, 0, head.length, 0);
      fs.closeSync(fd);
      if (!head.includes(Buffer.from("ftyp"))) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function removeInvalidLocalCache(localPath) {
  try {
    fs.unlinkSync(localPath);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<string|null>}
 */
async function getCachedMediaUrl(subPath) {
  const key = buildObjectKey(subPath);
  const localPath = localFsPath(subPath);
  const partPath = localPartPath(subPath);

  if (fs.existsSync(partPath)) {
    return null;
  }

  if (fs.existsSync(localPath)) {
    if (isLikelyValidMediaFile(localPath, subPath)) {
      return `/${key}`;
    }
    removeInvalidLocalCache(localPath);
  }

  const settings = await getSiteSettingsCached();
  if (!isR2Ready(settings)) return null;

  const { client, bucket } = getR2Client(settings);

  try {
    const head = await Promise.race([
      client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
      sleep(3000).then(() => {
        const err = new Error("R2 HeadObject timeout");
        err.code = "R2_HEAD_TIMEOUT";
        throw err;
      })
    ]);
    if (head?.ContentLength != null && head.ContentLength < minCachedBytes(subPath)) {
      return null;
    }
    return publicUrlForKey(settings, key, true);
  } catch {
    return null;
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} subPath
 * @param {string} contentType
 * @param {import('./tg-search-media-metrics').MediaTransferMetrics} [metrics]
 */
async function putCachedMedia(buffer, subPath, contentType, metrics) {
  metrics?.r2UploadBegin(buffer.length);
  const url = await saveMediaBytes(buffer, subPath, contentType, {
    onUploadProgress: metrics
      ? (loaded, total) => metrics.r2UploadProgress(loaded, total || buffer.length)
      : undefined
  });
  metrics?.r2UploadDone(url);
  return url;
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
 * @param {number} [retriesLeft]
 * @param {number | string} [thumbArg]
 * @param {import('./tg-search-media-metrics').MediaTransferMetrics} [metrics]
 */
async function downloadMediaBuffer(
  client,
  msg,
  wantThumb,
  signal,
  retriesLeft = mediaDownloadRetries(),
  thumbArg,
  metrics
) {
  throwIfAborted(signal);
  const { pickContentType } = require("./parse");
  const contentType = pickContentType(msg);
  const downloadOpts = wantThumb ? buildThumbDownloadOpts(contentType, thumbArg) : {};
  const timeoutMs =
    !wantThumb && contentType === "VIDEO" ? videoDownloadTimeoutMs() : mediaDownloadTimeoutMs();

  if (metrics) {
    const meta = extractMediaMeta(msg);
    metrics.tgDownloadBegin(!wantThumb ? meta.fileSize : undefined);
  }

  let timer;
  let onAbort;
  const racers = [];
  const downloadPromise = client.downloadMedia(msg, downloadOpts);
  racers.push(downloadPromise);
  racers.push(
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`媒体下载超时（${timeoutMs}ms）`);
        err.code = "DOWNLOAD_TIMEOUT";
        reject(err);
      }, timeoutMs);
    })
  );
  if (signal) {
    racers.push(
      new Promise((_, reject) => {
        onAbort = () => {
          const err = new Error("请求已取消");
          err.code = "REQUEST_ABORTED";
          reject(err);
        };
        if (signal.aborted) onAbort();
        else signal.addEventListener("abort", onAbort, { once: true });
      })
    );
  }

  let buffer;
  try {
    buffer = await Promise.race(racers);
  } catch (err) {
    const retryable =
      retriesLeft > 0 &&
      err?.code !== "REQUEST_ABORTED" &&
      (err?.code === "DOWNLOAD_TIMEOUT" || /TIMEOUT/i.test(String(err?.message || err)));
    if (retryable) {
      await sleep(600);
      throwIfAborted(signal);
      return downloadMediaBuffer(client, msg, wantThumb, signal, retriesLeft - 1, thumbArg, metrics);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    if (signal && onAbort) signal.removeEventListener("abort", onAbort);
  }

  throwIfAborted(signal);

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    const err = new Error("媒体下载失败");
    err.code = "DOWNLOAD_FAILED";
    throw err;
  }

  metrics?.tgDownloadDone(buffer.length);

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

async function downloadVideoThumbBuffer(client, msg, signal, metrics) {
  const candidates = pickDocumentThumbCandidates(msg);
  let lastErr;
  for (const thumbArg of candidates) {
    try {
      return await downloadMediaBuffer(client, msg, true, signal, mediaDownloadRetries(), thumbArg, metrics);
    } catch (err) {
      lastErr = err;
      if (err?.code === "REQUEST_ABORTED") throw err;
    }
  }
  const err = lastErr || new Error("视频封面下载失败");
  if (!err.code) err.code = "DOWNLOAD_FAILED";
  throw err;
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
    const mediaMeta = extractMediaMeta(msg);
    const metrics = new MediaTransferMetrics({
      username,
      messageId: msg.id,
      variant,
      contentType,
      fileSize: mediaMeta.fileSize,
      durationSec: mediaMeta.durationSec,
      source: opts.source || "cache"
    });
    metrics.start();

    if (cachedUrl) {
      metrics.markCached(cachedUrl);
      return {
        url: cachedUrl,
        cached: true,
        contentType,
        variant,
        messageId: msg.id,
        username
      };
    }

    let buffer;
    let mime;
    try {
      if (wantThumb && contentType === "VIDEO") {
        ({ buffer, mime } = await downloadVideoThumbBuffer(client, msg, opts.signal, metrics));
      } else {
        ({ buffer, mime } = await downloadMediaBuffer(client, msg, wantThumb, opts.signal, mediaDownloadRetries(), undefined, metrics));
      }
    } catch (thumbErr) {
      if (wantThumb && contentType === "PHOTO") {
        const fullSubPath = buildMediaSubPath(username, msg.id, "full", contentType);
        const fullCached = await getCachedMediaUrl(fullSubPath);
        if (fullCached) {
          metrics.markCached(fullCached);
          return {
            url: fullCached,
            cached: true,
            contentType,
            variant,
            messageId: msg.id,
            username
          };
        }
        ({ buffer, mime } = await downloadMediaBuffer(client, msg, false, opts.signal, mediaDownloadRetries(), undefined, metrics));
        const url = await putCachedMedia(buffer, fullSubPath, mime, metrics);
        console.log(
          `[tg-search:collector] cached media full-as-thumb ${username}/${msg.id} → ${url.slice(0, 80)}`
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
      }
      metrics.fail("TG下载", thumbErr);
      throw thumbErr;
    }
    try {
      const url = await putCachedMedia(buffer, subPath, mime, metrics);
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
    } catch (uploadErr) {
      metrics.fail("R2上传", uploadErr);
      throw uploadErr;
    }
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

/**
 * 并发 map，单项失败不中断；可选总耗时上限（到点停止接新任务）
 * @template T,R
 */
async function mapPoolSettled(items, concurrency, fn, opts = {}) {
  if (!items.length) return [];
  const { signal, budgetMs = 0, startedAt = Date.now() } = opts;
  const results = new Array(items.length);
  let cursor = 0;

  function overBudget() {
    return budgetMs > 0 && Date.now() - startedAt >= budgetMs;
  }

  async function worker() {
    while (cursor < items.length) {
      if (signal?.aborted || overBudget()) break;
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await fn(items[index], index) };
      } catch (err) {
        if (signal?.aborted || err?.code === "REQUEST_ABORTED") break;
        results[index] = { ok: false, error: err };
      }
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

module.exports = {
  buildMediaSubPath,
  getCachedMediaUrl,
  putCachedMedia,
  singleflight,
  downloadMediaBuffer,
  downloadVideoThumbBuffer,
  cacheMessageMediaWithClient,
  mapPool,
  mapPoolSettled,
  mediaBatchBudgetMs,
  mediaBatchMaxIds
};

/**
 * 视频流式下载迭代器 + R2 后台 warm（仅小视频）
 */
const bigInt = require("big-integer");
const { withGramClient } = require("./gram-client");
const {
  buildMediaSubPath,
  getCachedMediaUrl
} = require("./tg-search-media-cache");
const { saveMediaStream } = require("./save-media");
const { pickContentType } = require("./parse");
const { Api } = require("telegram/tl");
const { PassThrough } = require("stream");
const { MediaTransferMetrics, extractMediaMeta } = require("./tg-search-media-metrics");
const { isVideoWarmEnabled, videoWarmMaxBytes } = require("./tg-search-play-route");

function videoStreamChunkKb() {
  const n = Number(process.env.TG_SEARCH_VIDEO_STREAM_CHUNK_KB) || 256;
  return Math.min(1024, Math.max(64, Math.round(n)));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

function resolveVideoMime(msg) {
  const docMime = msg.media?.document?.mimeType || "";
  return docMime.startsWith("video/") ? docMime : "video/mp4";
}

/**
 * @param {number} [byteOffset]
 */
function buildVideoDownloadIter(client, msg, entity, chunkBytes, byteOffset = 0) {
  const media = msg.media;
  const doc =
    media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document
      ? media.document
      : null;

  if (!doc) {
    const err = new Error("该消息无视频文件");
    err.code = "NO_MEDIA";
    throw err;
  }

  const msgData = entity && msg.id ? [entity, msg.id] : undefined;

  return client.iterDownload({
    file: new Api.InputDocumentFileLocation({
      id: doc.id,
      accessHash: doc.accessHash,
      fileReference: doc.fileReference,
      thumbSize: ""
    }),
    offset: bigInt(Math.max(0, Math.floor(Number(byteOffset) || 0))),
    requestSize: chunkBytes,
    chunkSize: chunkBytes,
    fileSize: doc.size,
    dcId: doc.dcId,
    msgData
  });
}

async function getCachedFullMediaUrl(username, messageId) {
  const mid = Math.floor(Number(messageId));
  for (const contentType of ["VIDEO", "PHOTO"]) {
    const subPath = buildMediaSubPath(username, mid, "full", contentType);
    const url = await getCachedMediaUrl(subPath);
    if (url) return { url, contentType, messageId: mid, username };
  }
  return null;
}

/**
 * 后台 warm：仅当启用 warm 且文件 ≤ TG_SEARCH_VIDEO_WARM_MAX_MB
 */
async function streamVideoMessageToCache(client, username, msg, entity, opts = {}) {
  if (pickContentType(msg) !== "VIDEO") {
    const err = new Error("该消息不是视频");
    err.code = "NOT_VIDEO";
    throw err;
  }

  const mid = Math.floor(Number(msg.id));
  const meta = extractMediaMeta(msg);
  const fileSize = meta.fileSize || 0;
  if (!isVideoWarmEnabled()) {
    return null;
  }
  if (fileSize > videoWarmMaxBytes()) {
    console.log(
      `[tg-search:play] skip warm @${username}/#${mid} 大文件 ${fileSize} > ${videoWarmMaxBytes()}`
    );
    return null;
  }

  const subPath = buildMediaSubPath(username, mid, "full", "VIDEO");
  const cacheMime = resolveVideoMime(msg);
  const chunkBytes = videoStreamChunkKb() * 1024;

  const metrics = new MediaTransferMetrics({
    username,
    messageId: mid,
    variant: "full",
    contentType: "VIDEO",
    fileSize: meta.fileSize,
    durationSec: meta.durationSec,
    source: "warm-stream",
    forceMetrics: opts.metrics === true ? true : opts.metrics === false ? false : undefined
  });
  metrics.start();
  metrics.tgDownloadBegin(fileSize);

  const cachePass = new PassThrough();
  metrics.r2UploadBegin(fileSize);
  const uploadPromise = saveMediaStream(cachePass, subPath, cacheMime, {
    expectedBytes: fileSize,
    onUploadProgress: (loaded, total) => metrics.r2UploadProgress(loaded, total || fileSize)
  });
  const iter = buildVideoDownloadIter(client, msg, entity, chunkBytes, 0);

  let downloaded = 0;
  try {
    for await (const chunk of iter) {
      throwIfAborted(opts.signal);
      downloaded += chunk.length;
      metrics.tgDownloadProgress(downloaded, fileSize);
      if (!cachePass.write(chunk)) {
        await new Promise((resolve) => cachePass.once("drain", resolve));
      }
    }
    metrics.tgDownloadDone(downloaded);
    cachePass.end();
    const url = await uploadPromise;
    metrics.r2UploadDone(url);
    console.log(`[tg-search:play] warm 完成 @${username}/#${mid} → R2`);
    return { url, subPath, mime: cacheMime, messageId: mid, username };
  } catch (err) {
    cachePass.destroy();
    uploadPromise.catch(() => {});
    metrics.fail("stream", err);
    throw err;
  }
}

module.exports = {
  getCachedFullMediaUrl,
  streamVideoMessageToCache,
  buildVideoDownloadIter,
  resolveVideoMime,
  videoStreamChunkKb
};

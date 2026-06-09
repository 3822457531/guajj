/**
 * 视频流式输出：边从 Telegram 拉取边响应浏览器；缓存由 Worker 后台写入
 */
const { withGramClient } = require("./gram-client");
const {
  buildMediaSubPath,
  getCachedMediaUrl
} = require("./tg-search-media-cache");
const { saveMediaStream } = require("./save-media");
const { pickContentType } = require("./parse");
const { Api } = require("telegram/tl");
const { PassThrough } = require("stream");

function videoStreamChunkKb() {
  const n = Number(process.env.TG_SEARCH_VIDEO_STREAM_CHUNK_KB) || 512;
  return Math.min(1024, Math.max(64, Math.round(n)));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

/**
 * @param {import('telegram').Api.Message} msg
 * @param {import('telegram').EntityLike} entity
 * @param {number} chunkBytes
 */
function buildVideoDownloadIter(client, msg, entity, chunkBytes) {
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
    requestSize: chunkBytes,
    chunkSize: chunkBytes,
    fileSize: doc.size,
    dcId: doc.dcId,
    msgData
  });
}

function resolveVideoMime(msg) {
  const docMime = msg.media?.document?.mimeType || "";
  return docMime.startsWith("video/") ? docMime : "video/mp4";
}

/**
 * iterDownload → multipart 上传 R2/本地（Worker warm 用，无 HTTP 响应）
 */
async function streamVideoMessageToCache(client, username, msg, entity, opts = {}) {
  if (pickContentType(msg) !== "VIDEO") {
    const err = new Error("该消息不是视频");
    err.code = "NOT_VIDEO";
    throw err;
  }

  const mid = Math.floor(Number(msg.id));
  const subPath = buildMediaSubPath(username, mid, "full", "VIDEO");
  const cacheMime = resolveVideoMime(msg);
  const doc = msg.media?.document;
  const fileSize = doc?.size ? Number(doc.size) : undefined;
  const chunkBytes = videoStreamChunkKb() * 1024;

  console.log(
    `[tg-search:collector] video cache stream start ${username}/${mid} chunkKb=${videoStreamChunkKb()} size=${fileSize || "?"}`
  );

  const cachePass = new PassThrough();
  const uploadPromise = saveMediaStream(cachePass, subPath, cacheMime);
  const iter = buildVideoDownloadIter(client, msg, entity, chunkBytes);

  try {
    for await (const chunk of iter) {
      throwIfAborted(opts.signal);
      if (!cachePass.write(chunk)) {
        await new Promise((resolve) => cachePass.once("drain", resolve));
      }
    }
    cachePass.end();
    const url = await uploadPromise;
    console.log(
      `[tg-search:collector] video cache stream done ${username}/${mid} → ${String(url).slice(0, 80)}`
    );
    return { url, subPath, mime: cacheMime, messageId: mid, username };
  } catch (err) {
    cachePass.destroy();
    uploadPromise.catch(() => {});
    throw err;
  }
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

function enqueueBackgroundCache(username, messageId) {
  try {
    const { enqueueVideoWarmJob } = require("./media-worker");
    void enqueueVideoWarmJob({ username, messageId }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/**
 * 浏览器播放：仅 TG→HTTP 流式输出，不阻塞 R2；播完后后台 warm 写缓存
 */
async function createVideoStreamResponse(username, messageId, opts = {}) {
  const mid = Math.floor(Number(messageId));
  const cached = await getCachedFullMediaUrl(username, mid);
  if (cached?.contentType === "VIDEO") {
    return { redirect: cached.url };
  }

  const chunkBytes = videoStreamChunkKb() * 1024;
  const { ReadableStream } = require("stream/web");
  const responseMime = "video/mp4";
  let cacheEnqueued = false;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await withGramClient(async (client) => {
          throwIfAborted(opts.signal);
          const entity = await client.getEntity(username);
          const batch = await client.getMessages(entity, { ids: [mid] });
          const msg = batch?.[0];
          if (!msg?.media) {
            const err = new Error("该消息无媒体");
            err.code = "NO_MEDIA";
            throw err;
          }
          if (pickContentType(msg) !== "VIDEO") {
            const err = new Error("该消息不是视频");
            err.code = "NOT_VIDEO";
            throw err;
          }

          const cacheMime = resolveVideoMime(msg);
          const doc = msg.media?.document;
          const fileSize = doc?.size ? Number(doc.size) : undefined;

          console.log(
            `[tg-search:collector] video stream start ${username}/${mid} chunkKb=${videoStreamChunkKb()} size=${fileSize || "?"} mime=${cacheMime}`
          );

          const iter = buildVideoDownloadIter(client, msg, entity, chunkBytes);

          for await (const chunk of iter) {
            throwIfAborted(opts.signal);
            controller.enqueue(new Uint8Array(chunk));
          }

          controller.close();

          if (!cacheEnqueued) {
            cacheEnqueued = true;
            enqueueBackgroundCache(username, mid);
          }
        }, { ...opts, priority: "high" });
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          /* ignore double close */
        }
      }
    },
    cancel() {
      /* client disconnect handled by request.signal */
    }
  });

  return { stream, mime: responseMime };
}

module.exports = {
  getCachedFullMediaUrl,
  createVideoStreamResponse,
  streamVideoMessageToCache,
  buildVideoDownloadIter
};

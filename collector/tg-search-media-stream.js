/**
 * 视频流式输出：边从 Telegram 拉取边响应浏览器，首帧可在数秒内播放；完成后写 R2 缓存
 */
const { withGramClient } = require("./gram-client");
const { buildMediaSubPath, getCachedMediaUrl, putCachedMedia } = require("./tg-search-media-cache");
const { pickContentType } = require("./parse");
const { Api } = require("telegram/tl");

function videoStreamChunkKb() {
  const n = Number(process.env.TG_SEARCH_VIDEO_STREAM_CHUNK_KB) || 256;
  return Math.min(512, Math.max(64, Math.round(n)));
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

/**
 * GramJS iterDownload 不能直接传 Message，需传 MessageMediaDocument 或 InputDocumentFileLocation
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

/**
 * @param {string} username
 * @param {number} messageId
 */
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
 * @param {string} username
 * @param {number} messageId
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ redirect: string } | { stream: ReadableStream, mime: string, fileSize?: number }>}
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

  const stream = new ReadableStream({
    async start(controller) {
      const chunks = [];
      let cacheMime = responseMime;
      let subPath = "";

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

          const doc = msg.media?.document;
          cacheMime = doc?.mimeType?.startsWith("video/") ? doc.mimeType : responseMime;
          subPath = buildMediaSubPath(username, mid, "full", "VIDEO");
          const fileSize = doc?.size ? Number(doc.size) : undefined;

          console.log(
            `[tg-search:collector] video stream start ${username}/${mid} chunkKb=${videoStreamChunkKb()} size=${fileSize || "?"} mime=${cacheMime}`
          );

          const iter = buildVideoDownloadIter(client, msg, entity, chunkBytes);

          for await (const chunk of iter) {
            throwIfAborted(opts.signal);
            chunks.push(chunk);
            controller.enqueue(new Uint8Array(chunk));
          }

          controller.close();

          if (chunks.length) {
            const buffer = Buffer.concat(chunks);
            void putCachedMedia(buffer, subPath, cacheMime)
              .then((url) => {
                console.log(
                  `[tg-search:collector] video stream cached ${username}/${mid} → ${String(url).slice(0, 80)}`
                );
              })
              .catch((err) => {
                console.warn(
                  `[tg-search:collector] video stream cache fail ${username}/${mid}:`,
                  err?.message || err
                );
              });
          }
        }, { ...opts, priority: "low" });
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
  createVideoStreamResponse
};

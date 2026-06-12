/**
 * 视频播放：路由探测 + 带 Range 的 TG 直出流
 */
const { withGramClient } = require("./gram-client");
const { pickContentType } = require("./parse");
const {
  MediaTransferMetrics,
  extractMediaMeta
} = require("./tg-search-media-metrics");
const {
  classifyVideoPlayRoute,
  logVideoPlayRoute,
  parseHttpRange,
  isVideoWarmEnabled,
  videoWarmMaxBytes
} = require("./tg-search-play-route");
const {
  buildVideoDownloadIter,
  getCachedFullMediaUrl,
  resolveVideoMime,
  videoStreamChunkKb
} = require("./tg-search-media-stream");

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

async function fetchVideoMessageMeta(client, username, messageId) {
  const mid = Math.floor(Number(messageId));
  const uname = String(username || "").trim();
  const entity = await client.getEntity(uname);
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
  const mediaMeta = extractMediaMeta(msg);
  const fileSize = mediaMeta.fileSize || 0;
  const classified = classifyVideoPlayRoute({ cached: false, fileSize: mediaMeta.fileSize });
  return {
    entity,
    msg,
    mid,
    uname,
    mediaMeta,
    fileSize,
    mime: resolveVideoMime(msg),
    classified
  };
}

/**
 * 探测播放路由（不下载视频本体）
 */
async function resolveVideoPlayInfo(username, messageId, opts = {}) {
  const started = Date.now();
  const mid = Math.floor(Number(messageId));
  const uname = String(username || "").trim();
  if (!uname || mid <= 0) {
    const err = new Error("username 与 messageId 无效");
    err.code = "INVALID_PARAMS";
    throw err;
  }

  const cached = await getCachedFullMediaUrl(uname, mid);
  if (cached?.contentType === "VIDEO" && cached.url) {
    const classified = classifyVideoPlayRoute({ cached: true });
    const info = {
      username: uname,
      messageId: mid,
      route: classified.route,
      playMode: classified.playMode,
      largeFile: classified.largeFile,
      warmEligible: classified.warmEligible,
      cached: true,
      url: cached.url,
      fileSize: null,
      durationSec: null,
      warmMaxMb: Math.round(videoWarmMaxBytes() / (1024 * 1024)),
      warmEnabled: isVideoWarmEnabled()
    };
    logVideoPlayRoute({ ...info, ms: Date.now() - started });
    return info;
  }

  return withGramClient(
    async (client) => {
      throwIfAborted(opts.signal);
      const meta = await fetchVideoMessageMeta(client, uname, mid);
      const info = {
        username: uname,
        messageId: mid,
        route: meta.classified.route,
        playMode: meta.classified.playMode,
        largeFile: meta.classified.largeFile,
        warmEligible: meta.classified.warmEligible,
        cached: false,
        url: null,
        fileSize: meta.mediaMeta.fileSize,
        durationSec: meta.mediaMeta.durationSec,
        mime: meta.mime,
        warmMaxMb: Math.round(videoWarmMaxBytes() / (1024 * 1024)),
        warmEnabled: isVideoWarmEnabled()
      };
      logVideoPlayRoute({ ...info, ms: Date.now() - started });
      return info;
    },
    { ...opts, priority: "high" }
  );
}

/**
 * TG 直出流（支持 Range）；命中 R2 时返回 redirect
 */
async function createVideoStreamResponse(username, messageId, opts = {}) {
  const mid = Math.floor(Number(messageId));
  const uname = String(username || "").trim();
  const rangeHeader = opts.rangeHeader || null;

  const cached = await getCachedFullMediaUrl(uname, mid);
  if (cached?.contentType === "VIDEO" && cached.url) {
    const classified = classifyVideoPlayRoute({ cached: true });
    logVideoPlayRoute({
      username: uname,
      messageId: mid,
      ...classified,
      cached: true,
      range: rangeHeader || "full"
    });
    return {
      redirect: cached.url,
      playRoute: classified.route,
      playMode: classified.playMode,
      cached: true
    };
  }

  const head = await withGramClient(
    async (client) => {
      throwIfAborted(opts.signal);
      return fetchVideoMessageMeta(client, uname, mid);
    },
    { ...opts, priority: "high" }
  );

  const parsedRange = parseHttpRange(rangeHeader, head.fileSize);
  const rangeStart = parsedRange?.start ?? 0;
  const rangeEnd = parsedRange?.end ?? (head.fileSize > 0 ? head.fileSize - 1 : null);
  const rangeLen = parsedRange?.length ?? (head.fileSize > 0 ? head.fileSize : null);

  logVideoPlayRoute({
    username: uname,
    messageId: mid,
    ...head.classified,
    cached: false,
    fileSize: head.mediaMeta.fileSize,
    durationSec: head.mediaMeta.durationSec,
    range: parsedRange ? parsedRange.header : "full"
  });

  const chunkBytes = videoStreamChunkKb() * 1024;
  const { ReadableStream } = require("stream/web");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await withGramClient(
          async (client) => {
            throwIfAborted(opts.signal);
            const live = await fetchVideoMessageMeta(client, uname, mid);

            const metrics = new MediaTransferMetrics({
              username: uname,
              messageId: mid,
              variant: "full",
              contentType: "VIDEO",
              fileSize: live.mediaMeta.fileSize,
              durationSec: live.mediaMeta.durationSec,
              source:
                live.classified.route === "TG_STREAM_LARGE" ? "http-stream-large" : "http-stream"
            });
            metrics.start();
            metrics.tgDownloadBegin(live.fileSize);

            const iter = buildVideoDownloadIter(client, live.msg, live.entity, chunkBytes, rangeStart);
            let emitted = 0;
            let firstChunkAt = 0;
            const maxEmit = rangeLen != null ? rangeLen : Infinity;

            for await (const chunk of iter) {
              throwIfAborted(opts.signal);
              if (!firstChunkAt) {
                firstChunkAt = Date.now();
                console.log(
                  `[tg-search:play] @${uname}/#${mid} 首包 ${Date.now() - metrics.startedAt}ms · ${live.classified.playMode}`
                );
              }

              let slice = chunk;
              if (emitted + slice.length > maxEmit) {
                slice = slice.subarray(0, maxEmit - emitted);
              }
              if (slice.length > 0) {
                controller.enqueue(new Uint8Array(slice));
                emitted += slice.length;
              }
              metrics.tgDownloadProgress(rangeStart + emitted, live.fileSize);

              if (emitted >= maxEmit) break;
              if (rangeEnd != null && rangeStart + emitted - 1 >= rangeEnd) break;
            }

            metrics.tgDownloadDone(emitted);
            metrics.finish({ mode: "http-stream", range: Boolean(parsedRange) });
            controller.close();
          },
          { ...opts, priority: "high" }
        );
      } catch (err) {
        try {
          controller.error(err);
        } catch {
          /* ignore */
        }
      }
    },
    cancel() {
      /* request.signal */
    }
  });

  return {
    stream,
    mime: head.mime,
    fileSize: head.fileSize,
    playRoute: head.classified.route,
    playMode: head.classified.playMode,
    status: parsedRange ? 206 : 200,
    contentLength: rangeLen,
    contentRange: parsedRange?.header ?? null,
    cached: false
  };
}

module.exports = {
  resolveVideoPlayInfo,
  createVideoStreamResponse
};

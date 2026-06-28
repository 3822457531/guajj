/**
 * 视频播放：路由探测 + 带 Range 的 TG 直出流
 */
const { withGramClient } = require("./gram-client");
const { pickContentType } = require("./parse");
const {
  MediaTransferMetrics,
  extractMediaMeta,
  TgStreamSpeedLogger
} = require("./tg-search-media-metrics");
const {
  classifyVideoPlayRoute,
  logVideoPlayRoute,
  resolveStreamRange,
  isVideoWarmEnabled,
  videoWarmMaxBytes
} = require("./tg-search-play-route");
const {
  getCachedFullMediaUrl,
  resolveVideoMime,
  videoStreamChunkKb,
  iterVideoDownloadWithRetry
} = require("./tg-search-media-stream");

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }
}

function mergeAbortSignals(...signals) {
  const controller = new AbortController();
  const onAbort = (signal) => {
    if (!signal) return;
    if (signal.aborted) {
      controller.abort(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  };
  for (const s of signals) onAbort(s);
  return controller.signal;
}

const STREAM_HEAD_CACHE = new Map();
const STREAM_HEAD_TTL_MS = 10 * 60 * 1000;

function streamHeadKey(uname, mid) {
  return `${String(uname || "").toLowerCase()}:${Math.floor(Number(mid))}`;
}

function getCachedStreamHead(uname, mid) {
  const hit = STREAM_HEAD_CACHE.get(streamHeadKey(uname, mid));
  if (!hit || hit.expiresAt <= Date.now()) {
    if (hit) STREAM_HEAD_CACHE.delete(streamHeadKey(uname, mid));
    return null;
  }
  return hit.head;
}

function setCachedStreamHead(uname, mid, head) {
  STREAM_HEAD_CACHE.set(streamHeadKey(uname, mid), {
    head,
    expiresAt: Date.now() + STREAM_HEAD_TTL_MS
  });
}

function isRangeSwitchAbort(reason, rangeHeader) {
  const r = String(reason || "");
  if (r === "ResponseAborted" || r.includes("ResponseAborted")) return true;
  if (r === "stream_cancel" && rangeHeader) return true;
  return false;
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
    { ...opts, priority: "high", role: "media", task: "video-play-info" }
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

  let head = getCachedStreamHead(uname, mid);
  if (!head) {
    head = await withGramClient(
      async (client) => {
        throwIfAborted(opts.signal);
        return fetchVideoMessageMeta(client, uname, mid);
      },
      { ...opts, priority: "high", role: "stream", task: "video-stream-meta" }
    );
    setCachedStreamHead(uname, mid, head);
  } else {
    throwIfAborted(opts.signal);
    console.log(`[tg-search:play] @${uname}/#${mid} stream meta 命中缓存`);
  }

  const { parsed: parsedRange, forcedInitial } = resolveStreamRange(rangeHeader, head.fileSize);
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
    range: parsedRange ? parsedRange.header : "full",
    forcedInitial: forcedInitial || undefined
  });

  const chunkBytes = videoStreamChunkKb() * 1024;
  const { ReadableStream } = require("stream/web");
  const streamAbort = new AbortController();
  const streamSignal = mergeAbortSignals(opts.signal, streamAbort.signal);

  if (opts.signal) {
    if (opts.signal.aborted) {
      streamAbort.abort(opts.signal.reason || "client_abort");
    } else {
      opts.signal.addEventListener(
        "abort",
        () => {
          streamAbort.abort(opts.signal.reason || "client_abort");
          const reason = opts.signal.reason || "client_abort";
          if (isRangeSwitchAbort(reason, rangeHeader)) {
            console.log(
              `[tg-search:play] @${uname}/#${mid} stream Range 切换 · ${rangeHeader || "full"} · ${String(reason)}`
            );
          } else {
            console.log(`[tg-search:play] @${uname}/#${mid} 客户端断开连接 · ${String(reason)}`);
          }
        },
        { once: true }
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      /** @type {import('./tg-search-media-metrics').TgStreamSpeedLogger | null} */
      let speedLog = null;
      try {
        await withGramClient(
          async (client) => {
            throwIfAborted(streamSignal);
            const live = head;

            const streamSource =
              live.classified.route === "TG_STREAM_LARGE" ? "http-stream-large" : "http-stream";
            speedLog = new TgStreamSpeedLogger({
              username: uname,
              messageId: mid,
              fileSize: live.fileSize,
              source: streamSource,
              rangeStart
            });
            speedLog.onStart({ playMode: live.classified.playMode });

            const metrics = new MediaTransferMetrics({
              username: uname,
              messageId: mid,
              variant: "full",
              contentType: "VIDEO",
              fileSize: live.mediaMeta.fileSize,
              durationSec: live.mediaMeta.durationSec,
              source: streamSource,
              forceMetrics: opts.metrics === true ? true : opts.metrics === false ? false : undefined
            });
            metrics.start();
            metrics.tgDownloadBegin(live.fileSize);

            const iter = iterVideoDownloadWithRetry(
              client,
              live.msg,
              live.entity,
              chunkBytes,
              rangeStart,
              streamSignal
            );
            let emitted = 0;
            let firstChunkAt = 0;
            const maxEmit = rangeLen != null ? rangeLen : Infinity;

            for await (const chunk of iter) {
              throwIfAborted(streamSignal);
              if (!firstChunkAt) {
                firstChunkAt = Date.now();
                speedLog.onFirstChunk(chunk.length);
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
                speedLog.onChunk(slice.length);
              }
              metrics.tgDownloadProgress(rangeStart + emitted, live.fileSize);

              if (emitted >= maxEmit) break;
              if (rangeEnd != null && rangeStart + emitted - 1 >= rangeEnd) break;
            }

            metrics.tgDownloadDone(emitted);
            speedLog.finish({ mode: "http-stream", range: Boolean(parsedRange), emitted });
            metrics.finish({ mode: "http-stream", range: Boolean(parsedRange) });
            controller.close();
          },
          { signal: streamSignal, priority: "high", role: "stream", task: "video-stream", metrics: opts.metrics }
        );
      } catch (err) {
        if (err?.code === "REQUEST_ABORTED") {
          const reason = streamSignal.reason || opts.signal?.reason || "abort";
          speedLog?.abort({ reason: String(reason), range: Boolean(parsedRange) });
        } else {
          speedLog?.fail(err);
        }
        if (err?.code === "REQUEST_ABORTED") {
          const reason = streamSignal.reason || opts.signal?.reason || "abort";
          if (isRangeSwitchAbort(reason, rangeHeader)) {
            console.log(`[tg-search:play] @${uname}/#${mid} stream Range 结束 · ${String(reason)}`);
          } else {
            console.log(`[tg-search:play] @${uname}/#${mid} stream 已取消 · ${String(reason)}`);
          }
        } else if (/TIMEOUT/i.test(String(err?.message || err))) {
          console.warn(`[tg-search:play] @${uname}/#${mid} stream TIMEOUT`);
        }
        try {
          controller.error(err);
        } catch {
          /* ignore */
        }
      }
    },
    cancel(reason) {
      streamAbort.abort(reason || "stream_cancel");
      if (isRangeSwitchAbort(reason, rangeHeader)) {
        console.log(`[tg-search:play] @${uname}/#${mid} stream Range 切换 · ${String(reason || "stream_cancel")}`);
      } else {
        console.log(
          `[tg-search:play] @${uname}/#${mid} stream cancel · ${String(reason || "stream_cancel")}`
        );
      }
    }
  });

  return {
    stream,
    mime: head.mime,
    fileSize: head.fileSize,
    playRoute: head.classified.route,
    playMode: head.classified.playMode,
    status: parsedRange ? 206 : 200,
    forcedInitial: forcedInitial || false,
    contentLength: rangeLen,
    contentRange: parsedRange?.header ?? null,
    cached: false
  };
}

module.exports = {
  resolveVideoPlayInfo,
  createVideoStreamResponse
};

/**
 * 媒体后台队列：warm / 视频全量缓存与 HTTP 请求解耦，串行消费（单 Gram session）
 * 用户点击播放（高优先级 stream）时会抢占当前 warm 任务
 */
const { withGramClient } = require("./gram-client");
const {
  buildMediaSubPath,
  getCachedMediaUrl,
  singleflight
} = require("./tg-search-media-cache");
const { streamVideoMessageToCache } = require("./tg-search-media-stream");
const { logMetrics, formatBytes, extractMediaMeta } = require("./tg-search-media-metrics");
const { pickContentType } = require("./parse");

/** @type {Array<{ key: string, username: string, messageId: number, metrics?: boolean, resolve: (v: unknown) => void, reject: (e: Error) => void }>} */
const queue = [];

/** @type {Set<string>} */
const queuedKeys = new Set();

/** @type {Set<string>} */
const inflightKeys = new Set();

let draining = false;

function mediaWorkerMaxQueue() {
  return Math.min(64, Math.max(8, Number(process.env.TG_SEARCH_MEDIA_WORKER_MAX_QUEUE) || 32));
}

function channelWarmVideoMax() {
  return Math.min(12, Math.max(0, Number(process.env.TG_SEARCH_CHANNEL_WARM_MAX) || 6));
}

/** 超过此大小的视频不 warm 全量到 R2，改走 /media/stream 边播边拉 */
function videoWarmMaxBytes() {
  const mb = Number(process.env.TG_SEARCH_VIDEO_WARM_MAX_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.round(mb) * 1024 * 1024;
  return 80 * 1024 * 1024;
}

function warmLog(metrics, scope, message, extra) {
  if (!metrics) return;
  logMetrics(scope, message, extra);
}

/**
 * @param {{ username: string, messageId: number, metrics?: boolean }} job
 */
function enqueueVideoWarmJob(job) {
  const username = String(job.username || "").trim();
  const messageId = Math.floor(Number(job.messageId));
  if (!username || messageId <= 0) return Promise.resolve(null);

  const key = `video_full:${username}:${messageId}`;
  const metrics = Boolean(job.metrics);

  if (inflightKeys.has(key) || queuedKeys.has(key)) {
    return Promise.resolve(null);
  }

  if (queue.length >= mediaWorkerMaxQueue()) {
    console.warn(`[tg-search:media-worker] queue full (${queue.length}), drop ${key}`);
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    queue.push({ key, username, messageId, metrics, resolve, reject });
    queuedKeys.add(key);
    warmLog(metrics, "WARM", `排队 @${username}/#${messageId}`, { queueLen: queue.length });
    void drainQueue();
  });
}

function enqueueChannelVideoWarmBatch(username, messageIds, opts = {}) {
  const max = channelWarmVideoMax();
  if (max <= 0) return 0;
  const ids = [...new Set(messageIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0))].slice(
    0,
    max
  );
  for (const messageId of ids) {
    void enqueueVideoWarmJob({ username, messageId, metrics: Boolean(opts.metrics) });
  }
  return ids.length;
}

async function drainQueue() {
  if (draining) return;
  draining = true;

  while (queue.length) {
    const job = queue.shift();
    if (!job) break;
    queuedKeys.delete(job.key);
    inflightKeys.add(job.key);

    try {
      const result = await processVideoWarmJob(job);
      job.resolve(result);
    } catch (err) {
      const code = err?.code;
      if (code === "REQUEST_ABORTED") {
        console.log(`[tg-search:media-worker] preempted, re-queue ${job.key}`);
        queue.unshift(job);
        queuedKeys.add(job.key);
        job.resolve(null);
      } else {
        console.warn(
          `[tg-search:media-worker] fail ${job.username}/${job.messageId}:`,
          err?.message || err
        );
        job.resolve(null);
      }
    } finally {
      inflightKeys.delete(job.key);
    }
  }

  draining = false;

  if (queue.length) {
    void drainQueue();
  }
}

async function processVideoWarmJob(job) {
  const { username, messageId, metrics } = job;
  const mid = Math.floor(Number(messageId));
  const started = Date.now();
  const subPath = buildMediaSubPath(username, mid, "full", "VIDEO");
  const cachedUrl = await getCachedMediaUrl(subPath);
  if (cachedUrl) {
    warmLog(metrics, "WARM", `@${username}/#${mid} 已缓存，跳过 warm`, { ms: Date.now() - started });
    return { url: cachedUrl, cached: true, contentType: "VIDEO" };
  }

  warmLog(metrics, "WARM", `@${username}/#${mid} 开始后台 warm（TG→R2 流式）`);
  const flightKey = `worker:warm:${username}:${mid}`;
  const maxBytes = videoWarmMaxBytes();

  return singleflight(flightKey, () =>
    withGramClient(async (client) => {
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

      const meta = extractMediaMeta(msg);
      const fileSize = meta.fileSize || 0;
      if (fileSize > maxBytes) {
        warmLog(metrics, "WARM", `@${username}/#${mid} 跳过 warm`, {
          reason: "TOO_LARGE",
          size: formatBytes(fileSize),
          max: formatBytes(maxBytes),
          duration: meta.durationSec ? `${meta.durationSec}s` : undefined,
          hint: "大视频请走 /media/stream 边播，勿全量缓存 R2"
        });
        return { skipped: true, reason: "TOO_LARGE", contentType: "VIDEO" };
      }

      const result = await streamVideoMessageToCache(client, username, msg, entity, {
        source: "media-worker",
        metrics
      });
      if (!result) {
        warmLog(metrics, "WARM", `@${username}/#${mid} 跳过（warm 未启用或文件过大）`);
        return { skipped: true, reason: "WARM_DISABLED_OR_LARGE", contentType: "VIDEO" };
      }
      warmLog(metrics, "WARM", `@${username}/#${mid} warm 完成`, { ms: Date.now() - started });
      return {
        url: result.url,
        cached: false,
        contentType: "VIDEO"
      };
    }, { priority: "low" })
  );
}

function getMediaWorkerStats() {
  return {
    queued: queue.length,
    inflight: inflightKeys.size
  };
}

module.exports = {
  enqueueVideoWarmJob,
  enqueueChannelVideoWarmBatch,
  getMediaWorkerStats,
  videoWarmMaxBytes
};

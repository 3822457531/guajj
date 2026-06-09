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

/** @type {Array<{ key: string, username: string, messageId: number, resolve: (v: unknown) => void, reject: (e: Error) => void }>} */
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
  return Math.min(8, Math.max(0, Number(process.env.TG_SEARCH_CHANNEL_WARM_MAX) || 2));
}

/**
 * @param {{ username: string, messageId: number }} job
 * @returns {Promise<{ url: string, cached?: boolean, contentType?: string } | null>}
 */
function enqueueVideoWarmJob(job) {
  const username = String(job.username || "").trim();
  const messageId = Math.floor(Number(job.messageId));
  if (!username || messageId <= 0) return Promise.resolve(null);

  const key = `video_full:${username}:${messageId}`;

  if (inflightKeys.has(key) || queuedKeys.has(key)) {
    return Promise.resolve(null);
  }

  if (queue.length >= mediaWorkerMaxQueue()) {
    console.warn(`[tg-search:media-worker] queue full (${queue.length}), drop ${key}`);
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    queue.push({ key, username, messageId, resolve, reject });
    queuedKeys.add(key);
    void drainQueue();
  });
}

/**
 * 频道加载时批量 warm，默认最多 2 条，避免占满 Gram 阻塞用户点击播放
 * @param {string} username
 * @param {number[]} messageIds
 */
function enqueueChannelVideoWarmBatch(username, messageIds) {
  const max = channelWarmVideoMax();
  if (max <= 0) return 0;
  const ids = [...new Set(messageIds.map((id) => Math.floor(Number(id))).filter((id) => id > 0))].slice(
    0,
    max
  );
  for (const messageId of ids) {
    void enqueueVideoWarmJob({ username, messageId });
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
      const result = await processVideoWarmJob(job.username, job.messageId);
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

async function processVideoWarmJob(username, messageId) {
  const mid = Math.floor(Number(messageId));
  const subPath = buildMediaSubPath(username, mid, "full", "VIDEO");
  const cachedUrl = await getCachedMediaUrl(subPath);
  if (cachedUrl) {
    return { url: cachedUrl, cached: true, contentType: "VIDEO" };
  }

  const flightKey = `worker:warm:${username}:${mid}`;

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

      const result = await streamVideoMessageToCache(client, username, msg, entity);
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
  getMediaWorkerStats
};

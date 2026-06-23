/**
 * GramJS 双 session 池：
 * - search：session.txt — 极搜 Bot、筛选翻页等
 * - media：back.txt — 频道媒体下载、视频流、warm
 *
 * 同一 session 禁止并发 RPC（AUTH_KEY_DUPLICATED）。
 * 配置独立 back.txt 后，搜索与播放可并行，互不抢占。
 *
 * 控制台过滤：grep "[tg-search:gram]"
 */
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const {
  requireEnv,
  readSession,
  sessionsAreSplit,
  streamSessionIsSplit,
  requireGramCredentials,
  mediaApiIsSplit,
  describeSessionProfile,
  sessionBasename
} = require("./config");

function gramLog(event, message, extra) {
  const suffix =
    extra && Object.keys(extra).length
      ? ` ${JSON.stringify(extra)}`
      : "";
  console.log(`[tg-search:gram] ${event} ${message}${suffix}`);
}

function gramProfileLog() {
  const p = describeSessionProfile();
  gramLog(
    "profile",
    p.dualSession
      ? "双 session · 频道详情走 search，媒体下载走 media" + (p.streamSessionSplit ? "，视频流独立 stream" : "")
      : "单 session 模式 · 搜索与媒体串行共享连接"
  );
  gramLog("profile", "搜索链路", {
    session: p.search.sessionName,
    apiId: p.search.apiId,
    phone: p.search.phone,
    ready: p.search.ready,
    tasks: "极搜 / 频道详情(双session时)"
  });
  gramLog("profile", "媒体链路", {
    session: p.media.sessionName,
    apiId: p.media.apiId,
    phone: p.media.phone,
    ready: p.media.ready,
    tasks: "缩略图batch / warm / play-info"
  });
  gramLog("profile", "视频流链路", {
    session: p.stream.sessionName,
    apiId: p.stream.apiId,
    phone: p.stream.phone,
    ready: p.stream.ready,
    sharesMediaSession: p.stream.sharesMediaSession,
    tasks: p.stream.sharesMediaSession ? "与媒体共用(长流会阻塞batch)" : "独立(多人并发播放)"
  });
}

/**
 * @param {'search' | 'media'} label
 * @param {() => { file: string, session: string }} resolveSession
 * @param {() => { apiId: number, apiHash: string, phone?: string }} resolveApi
 */
function createGramPool(label, resolveSession, resolveApi) {
  /** @type {TelegramClient | null} */
  let sharedClient = null;
  /** @type {Promise<TelegramClient> | null} */
  let connecting = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let idleTimer = null;
  /** @type {AbortController | null} */
  let activeLowPriorityAbort = null;
  let lowPriorityGeneration = 0;
  let mutexHeld = false;
  /** @type {Array<{ priority: 'high' | 'low', generation: number, resolve: () => void, reject: (err: Error) => void, onAbort?: () => void, task?: string }>} */
  const mutexWaiters = [];
  let activeGramWork = 0;
  /** @type {string | null} */
  let activeTask = null;
  let tasksStarted = 0;

  function poolMeta(extra) {
    const { file } = resolveSession();
    const { apiId, phone } = resolveApi();
    return {
      pool: label,
      session: sessionBasename(file),
      apiId,
      phone: phone ? `***${String(phone).slice(-4)}` : undefined,
      active: activeGramWork,
      queue: mutexWaiters.length,
      mutex: mutexHeld ? "held" : "free",
      currentTask: activeTask || undefined,
      ...extra
    };
  }

  function clearIdleTimer() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }

  function scheduleIdleDisconnect() {
    if (activeGramWork > 0) {
      clearIdleTimer();
      return;
    }
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (activeGramWork > 0) return;
      void dropSharedClient("idle");
    }, gramIdleMs());
  }

  function beginGramWork(task) {
    activeGramWork++;
    activeTask = task || activeTask;
    clearIdleTimer();
    logCrossPoolConcurrency("begin");
  }

  function endGramWork() {
    activeGramWork = Math.max(0, activeGramWork - 1);
    if (activeGramWork === 0) activeTask = null;
    scheduleIdleDisconnect();
    logCrossPoolConcurrency("end");
  }

  async function dropSharedClient(reason) {
    clearIdleTimer();
    const client = sharedClient;
    sharedClient = null;
    connecting = null;
    if (!client) return;
    try {
      await client.disconnect();
      gramLog("disconnect", `${label} · ${sessionBasename(resolveSession().file)}`, { reason });
    } catch (err) {
      console.warn(`[tg-search:gram] disconnect-warn ${label}:`, err?.message || err);
    }
  }

  function rejectQueuedLowPriority(reason) {
    lowPriorityGeneration++;
    const err = abortedError(reason);
    const keep = [];
    for (const waiter of mutexWaiters) {
      if (waiter.priority === "low") {
        if (waiter.onAbort) waiter.onAbort();
        waiter.reject(err);
      } else {
        keep.push(waiter);
      }
    }
    mutexWaiters.length = 0;
    mutexWaiters.push(...keep);
  }

  function cancelActiveLowPriority(reason) {
    if (!activeLowPriorityAbort) return;
    gramLog("preempt", `${label} 打断低优先级任务`, poolMeta({ reason }));
    activeLowPriorityAbort.abort();
    activeLowPriorityAbort = null;
  }

  function preemptLowPriorityWork(reason = "high_priority") {
    rejectQueuedLowPriority(reason);
    cancelActiveLowPriority(reason);
  }

  function assertLowGeneration(generation) {
    if (generation !== lowPriorityGeneration) {
      throw abortedError("preempt");
    }
  }

  function acquireGramTurn(priority, signal, task) {
    if (priority === "high") {
      preemptLowPriorityWork("high_priority_enqueue");
    }

    const generation = lowPriorityGeneration;

    if (signal?.aborted) {
      throw abortedError("abort");
    }

    if (!mutexHeld) {
      mutexHeld = true;
      return Promise.resolve(generation);
    }

    gramLog(
      "queue",
      `${label} 等待 mutex（同 session 内串行）`,
      poolMeta({ waitTask: task, waitPriority: priority })
    );

    return new Promise((resolve, reject) => {
      const entry = {
        priority,
        generation,
        task,
        resolve: () => {
          gramLog("queue", `${label} 获得 mutex`, poolMeta({ task, priority }));
          resolve(generation);
        },
        reject
      };

      if (signal) {
        const onAbort = () => {
          const idx = mutexWaiters.indexOf(entry);
          if (idx >= 0) mutexWaiters.splice(idx, 1);
          reject(abortedError("abort"));
        };
        entry.onAbort = onAbort;
        signal.addEventListener("abort", onAbort, { once: true });
      }

      if (priority === "high") {
        mutexWaiters.unshift(entry);
      } else {
        mutexWaiters.push(entry);
      }
    });
  }

  function releaseGramTurn() {
    mutexHeld = false;

    while (mutexWaiters.length) {
      const highIdx = mutexWaiters.findIndex((w) => w.priority === "high");
      const idx = highIdx >= 0 ? highIdx : 0;
      const next = mutexWaiters.splice(idx, 1)[0];

      if (next.priority === "low" && next.generation !== lowPriorityGeneration) {
        next.reject(abortedError("preempt"));
        continue;
      }

      mutexHeld = true;
      next.resolve();
      return;
    }
  }

  async function acquireSharedClient() {
    if (sharedClient?.connected) {
      scheduleIdleDisconnect();
      return sharedClient;
    }

    if (connecting) return connecting;

    const { file, session } = resolveSession();
    if (!session) {
      console.error(`[tg-search:gram] NO_SESSION pool=${label} sessionFile=${file}`);
      const err = new Error(
        label === "stream"
          ? "未找到视频流 session，请配置 TG_STREAM_SESSION_FILE 并 npm run collector:login:stream"
          : label === "media"
            ? "未找到播放 session（back.txt），请运行 npm run collector:login:media"
            : "未找到搜索 session，请先运行 npm run collector:login"
      );
      err.code = "NO_SESSION";
      throw err;
    }

    connecting = (async () => {
      const creds = resolveApi();
      gramLog("connect", `${label} · ${sessionBasename(file)}`, { apiId: creds.apiId });
      const client = new TelegramClient(new StringSession(session), creds.apiId, creds.apiHash, {
        connectionRetries: 5,
        timeout: gramRpcTimeoutSec(),
        retryDelay: 1200,
        autoReconnect: true
      });
      await client.connect();
      sharedClient = client;
      connecting = null;
      scheduleIdleDisconnect();
      gramLog("connect", `${label} 已连接`, { session: sessionBasename(file), apiId: creds.apiId });
      return client;
    })();

    try {
      return await connecting;
    } catch (err) {
      connecting = null;
      throw err;
    }
  }

  async function withGramClient(fn, options = {}) {
    const priority = options.priority === "low" ? "low" : "high";
    const task = String(options.task || "rpc");

    /** @type {AbortController | null} */
    let lowLocalAbort = null;
    let effectiveSignal = options.signal;

    if (priority === "low") {
      lowLocalAbort = new AbortController();
      activeLowPriorityAbort = lowLocalAbort;
      effectiveSignal = mergeAbortSignals(options.signal, lowLocalAbort.signal);
    }

    const started = Date.now();
    tasksStarted++;
    const taskId = tasksStarted;

    gramLog("start", task, poolMeta({ taskId, priority }));

    let turnGeneration;
    beginGramWork(task);
    try {
      turnGeneration = await acquireGramTurn(priority, effectiveSignal, task);

      if (priority === "low") {
        assertLowGeneration(turnGeneration);
      }

      if (effectiveSignal?.aborted) {
        throw abortedError("abort");
      }

      const client = await acquireSharedClient();
      if (priority === "low") {
        assertLowGeneration(turnGeneration);
      }

      if (effectiveSignal?.aborted) {
        throw abortedError("abort");
      }

      scheduleIdleDisconnect();
      const result = await fn(client);
      gramLog("done", task, poolMeta({ taskId, priority, ms: Date.now() - started, ok: true }));
      return result;
    } catch (err) {
      const code = err?.code || "ERROR";
      gramLog("done", task, poolMeta({
        taskId,
        priority,
        ms: Date.now() - started,
        ok: false,
        code
      }));
      if (isSessionFatal(err)) {
        await dropSharedClient("session_fatal");
      }
      throw err;
    } finally {
      if (lowLocalAbort && activeLowPriorityAbort === lowLocalAbort) {
        activeLowPriorityAbort = null;
      }
      releaseGramTurn();
      endGramWork();
    }
  }

  function getStats() {
    const { file } = resolveSession();
    const { apiId } = resolveApi();
    return {
      pool: label,
      session: sessionBasename(file),
      apiId,
      connected: Boolean(sharedClient?.connected),
      active: activeGramWork,
      queue: mutexWaiters.length,
      mutexHeld,
      currentTask: activeTask
    };
  }

  return { withGramClient, preemptLowPriorityWork, dropSharedClient, label, getStats };
}

/** @type {ReturnType<typeof createGramPool> | null} */
let searchPoolRef = null;
/** @type {ReturnType<typeof createGramPool> | null} */
let mediaPoolRef = null;

/** @type {ReturnType<typeof createGramPool> | null} */
let streamPoolRef = null;

function logCrossPoolConcurrency(phase) {
  if (!searchPoolRef || !mediaPoolRef || !sessionsAreSplit()) return;
  const s = searchPoolRef.getStats();
  const m = mediaPoolRef.getStats();
  const st = streamPoolRef && streamPoolRef !== mediaPoolRef ? streamPoolRef.getStats() : null;
  const parts = [];
  if (s.active > 0) parts.push({ pool: "search", session: s.session, task: s.currentTask });
  if (m.active > 0) parts.push({ pool: "media", session: m.session, task: m.currentTask });
  if (st?.active > 0) parts.push({ pool: "stream", session: st.session, task: st.currentTask });
  if (parts.length >= 2) {
    gramLog(
      "parallel",
      phase === "begin" ? "多 session 并发工作中" : "多 session 仍有并行任务",
      { pools: parts }
    );
  }
}

function gramIdleMs() {
  const n = Number(process.env.TG_GRAM_IDLE_MS) || 120000;
  return Math.min(300000, Math.max(30000, Math.round(n)));
}

function gramRpcTimeoutSec() {
  const n = Number(process.env.TG_GRAM_RPC_TIMEOUT_SEC) || 120;
  return Math.min(300, Math.max(30, Math.round(n)));
}

function abortedError(reason) {
  const err = new Error(reason === "preempt" ? "请求已被高优先级任务打断" : "请求已取消");
  err.code = "REQUEST_ABORTED";
  return err;
}

function isSessionFatal(err) {
  const msg = String(err?.errorMessage || err?.message || err);
  return /SESSION_REVOKED|AUTH_KEY_DUPLICATED|AUTH_KEY_UNREGISTERED|USER_DEACTIVATED/i.test(msg);
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

function resolveSearchSession() {
  const { sessionFile } = requireEnv();
  return { file: sessionFile, session: readSession(sessionFile) };
}

function resolveMediaSession() {
  const { sessionFile, mediaSessionFile } = requireEnv();
  const mediaSession = readSession(mediaSessionFile);
  if (mediaSession) {
    return { file: mediaSessionFile, session: mediaSession };
  }
  return { file: sessionFile, session: readSession(sessionFile) };
}

function resolveStreamSession() {
  const { streamSessionFile, mediaSessionFile, sessionFile } = requireEnv();
  const streamSession = readSession(streamSessionFile);
  if (streamSession && streamSessionFile !== mediaSessionFile) {
    return { file: streamSessionFile, session: streamSession };
  }
  return resolveMediaSession();
}

const searchPool = createGramPool("search", resolveSearchSession, () => requireGramCredentials("search"));
const mediaPool = createGramPool("media", resolveMediaSession, () => requireGramCredentials("media"));
const streamPool = streamSessionIsSplit()
  ? createGramPool("stream", resolveStreamSession, () => requireGramCredentials("stream"))
  : mediaPool;
searchPoolRef = searchPool;
mediaPoolRef = mediaPool;
streamPoolRef = streamPool;

let profileLogged = false;

function logSessionProfileOnce() {
  if (profileLogged) return;
  profileLogged = true;
  gramProfileLog();
}

function getPool(role) {
  logSessionProfileOnce();
  if (role === "stream") {
    return streamPool;
  }
  if (role === "media") {
    return sessionsAreSplit() ? mediaPool : searchPool;
  }
  return searchPool;
}

/**
 * @template T
 * @param {(client: import('telegram').TelegramClient) => Promise<T>} fn
 * @param {{ signal?: AbortSignal, priority?: 'high' | 'low', role?: 'search' | 'media' | 'stream', task?: string }} [options]
 */
async function withGramClient(fn, options = {}) {
  const role =
    options.role === "stream" ? "stream" : options.role === "media" ? "media" : "search";
  return getPool(role).withGramClient(fn, options);
}

/** 新搜索到达时打断低优先级媒体任务；双 session 模式下搜索不再打断播放 */
function preemptLowPriorityWork(reason = "high_priority") {
  if (sessionsAreSplit()) {
    gramLog("preempt", "跳过（双 session 已分离，搜索不抢占播放）", { reason });
    return;
  }
  gramLog("preempt", "单 session 模式 · 搜索打断媒体低优先级任务", { reason });
  searchPool.preemptLowPriorityWork(reason);
}

async function dropSharedClient(reason) {
  const jobs = [searchPool.dropSharedClient(reason), mediaPool.dropSharedClient(reason)];
  if (streamPool !== mediaPool) {
    jobs.push(streamPool.dropSharedClient(reason));
  }
  await Promise.all(jobs);
}

function getGramPoolStats() {
  logSessionProfileOnce();
  return {
    dualSession: sessionsAreSplit(),
    streamSessionSplit: streamSessionIsSplit(),
    independentMediaApp: mediaApiIsSplit(),
    search: searchPool.getStats(),
    media: mediaPool.getStats(),
    stream: streamPool.getStats()
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  withGramClient,
  sleep,
  dropSharedClient,
  preemptLowPriorityWork,
  sessionsAreSplit,
  getGramPoolStats,
  describeSessionProfile
};

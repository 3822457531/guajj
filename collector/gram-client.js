/**
 * 复用 collector session 的 GramJS 连接（API / 测试页用）
 * 同一 session 禁止并发 RPC，否则 Telegram 返回 AUTH_KEY_DUPLICATED
 * 高优先级（搜索/频道）可抢占低优先级（媒体批量/缩略图/视频流），并清空排队中的低优先级任务
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");

/** @type {TelegramClient | null} */
let sharedClient = null;

/** @type {Promise<TelegramClient> | null} */
let connecting = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let idleTimer = null;

/** @type {AbortController | null} */
let activeLowPriorityAbort = null;

/** @type {number} 每次 preempt 递增，排队/执行中的低优先级任务需比对 */
let lowPriorityGeneration = 0;

/** @type {boolean} */
let mutexHeld = false;

/**
 * @type {Array<{
 *   priority: 'high' | 'low',
 *   generation: number,
 *   resolve: () => void,
 *   reject: (err: Error) => void,
 *   onAbort?: () => void
 * }>}
 */
const mutexWaiters = [];

/** @type {number} 进行中的 Gram 任务（含长视频下载），>0 时不 idle 断连 */
let activeGramWork = 0;

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

function beginGramWork() {
  activeGramWork++;
  clearIdleTimer();
}

function endGramWork() {
  activeGramWork = Math.max(0, activeGramWork - 1);
  scheduleIdleDisconnect();
}

async function dropSharedClient(reason) {
  clearIdleTimer();
  const client = sharedClient;
  sharedClient = null;
  connecting = null;
  if (!client) return;
  try {
    await client.disconnect();
    console.log(`[tg-search:collector] GramJS disconnected (${reason})`);
  } catch (err) {
    console.warn(`[tg-search:collector] GramJS disconnect warn:`, err?.message || err);
  }
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
  console.log(`[tg-search:collector] GramJS preempt active low (${reason})`);
  activeLowPriorityAbort.abort();
  activeLowPriorityAbort = null;
  /* 不断开连接：避免抢占后 stream 重连竞态导致 TIMEOUT */
}

/** 搜索等新任务到达时主动打断媒体下载，并清空低优先级排队 */
function preemptLowPriorityWork(reason = "high_priority") {
  rejectQueuedLowPriority(reason);
  cancelActiveLowPriority(reason);
}

function assertLowGeneration(generation) {
  if (generation !== lowPriorityGeneration) {
    throw abortedError("preempt");
  }
}

/**
 * @param {'high' | 'low'} priority
 * @param {AbortSignal | undefined} signal
 */
function acquireGramTurn(priority, signal) {
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

  return new Promise((resolve, reject) => {
    const entry = {
      priority,
      generation,
      resolve: () => resolve(generation),
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

/**
 * @returns {Promise<TelegramClient>}
 */
async function acquireSharedClient() {
  if (sharedClient?.connected) {
    scheduleIdleDisconnect();
    return sharedClient;
  }

  if (connecting) return connecting;

  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    console.error(`[tg-search:collector] NO_SESSION sessionFile=${sessionFile}`);
    const err = new Error("未找到采集 session，请先运行 npm run collector:login");
    err.code = "NO_SESSION";
    throw err;
  }

  connecting = (async () => {
    console.log(`[tg-search:collector] GramJS connect sessionFile=${sessionFile}`);
    const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
      connectionRetries: 5,
      timeout: gramRpcTimeoutSec(),
      retryDelay: 1200,
      autoReconnect: true
    });
    await client.connect();
    sharedClient = client;
    connecting = null;
    scheduleIdleDisconnect();
    console.log(`[tg-search:collector] GramJS connected (persistent)`);
    return client;
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    throw err;
  }
}

/**
 * @template T
 * @param {(client: TelegramClient) => Promise<T>} fn
 * @param {{ signal?: AbortSignal, priority?: 'high' | 'low' }} [options]
 * @returns {Promise<T>}
 */
async function withGramClient(fn, options = {}) {
  const priority = options.priority === "low" ? "low" : "high";

  /** @type {AbortController | null} */
  let lowLocalAbort = null;
  let effectiveSignal = options.signal;

  if (priority === "low") {
    lowLocalAbort = new AbortController();
    activeLowPriorityAbort = lowLocalAbort;
    effectiveSignal = mergeAbortSignals(options.signal, lowLocalAbort.signal);
  }

  let turnGeneration;
  beginGramWork();
  try {
    turnGeneration = await acquireGramTurn(priority, effectiveSignal);

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
    return await fn(client);
  } catch (err) {
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { withGramClient, sleep, dropSharedClient, preemptLowPriorityWork };

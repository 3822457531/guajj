/**
 * 复用 collector session 的 GramJS 连接（API / 测试页用）
 * 同一 session 禁止并发 RPC，否则 Telegram 返回 AUTH_KEY_DUPLICATED
 * 连接保持 warm：避免每次 /media 都 reconnect + 跨 DC 握手（主要慢点）
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");

/** @type {Promise<void>} */
let gramMutex = Promise.resolve();

/** @type {TelegramClient | null} */
let sharedClient = null;

/** @type {Promise<TelegramClient> | null} */
let connecting = null;

/** @type {ReturnType<typeof setTimeout> | null} */
let idleTimer = null;

function gramIdleMs() {
  const n = Number(process.env.TG_GRAM_IDLE_MS) || 45000;
  return Math.min(120000, Math.max(10000, Math.round(n)));
}

function gramRpcTimeoutSec() {
  const n = Number(process.env.TG_GRAM_RPC_TIMEOUT_SEC) || 45;
  return Math.min(90, Math.max(15, Math.round(n)));
}

function clearIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleDisconnect() {
  clearIdleTimer();
  idleTimer = setTimeout(() => {
    void dropSharedClient("idle");
  }, gramIdleMs());
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
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<T>}
 */
async function withGramClient(fn, options = {}) {
  const { signal } = options;

  if (signal?.aborted) {
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }

  let releaseMutex;
  const waitTurn = gramMutex;
  gramMutex = new Promise((resolve) => {
    releaseMutex = resolve;
  });

  await waitTurn;

  if (signal?.aborted) {
    releaseMutex();
    const err = new Error("请求已取消");
    err.code = "REQUEST_ABORTED";
    throw err;
  }

  try {
    const client = await acquireSharedClient();
    if (signal?.aborted) {
      const err = new Error("请求已取消");
      err.code = "REQUEST_ABORTED";
      throw err;
    }
    scheduleIdleDisconnect();
    return await fn(client);
  } catch (err) {
    if (isSessionFatal(err)) {
      await dropSharedClient("session_fatal");
    }
    throw err;
  } finally {
    releaseMutex();
    scheduleIdleDisconnect();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { withGramClient, sleep, dropSharedClient };

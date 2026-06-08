/**
 * 复用 collector session 的 GramJS 短连接（API / 测试页用）
 * 同一 session 禁止并发 connect，否则 Telegram 返回 AUTH_KEY_DUPLICATED
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");

/** @type {Promise<void>} */
let gramMutex = Promise.resolve();

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

  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    releaseMutex();
    console.error(`[tg-search:collector] NO_SESSION sessionFile=${sessionFile}`);
    const err = new Error("未找到采集 session，请先运行 npm run collector:login");
    err.code = "NO_SESSION";
    throw err;
  }

  console.log(`[tg-search:collector] GramJS connect sessionFile=${sessionFile}`);
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });

  const onAbort = () => {
    console.log(`[tg-search:collector] GramJS abort disconnect`);
    client.disconnect().catch(() => {});
  };
  if (signal) {
    signal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    await client.connect();
    console.log(`[tg-search:collector] GramJS connected`);
    if (signal?.aborted) {
      const err = new Error("请求已取消");
      err.code = "REQUEST_ABORTED";
      throw err;
    }
    return await fn(client);
  } finally {
    if (signal) {
      signal.removeEventListener("abort", onAbort);
    }
    try {
      await client.disconnect();
      console.log(`[tg-search:collector] GramJS disconnected`);
    } catch (disconnectErr) {
      console.warn(
        `[tg-search:collector] GramJS disconnect warn:`,
        disconnectErr?.message || disconnectErr
      );
    }
    releaseMutex();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { withGramClient, sleep };

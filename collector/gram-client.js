/**
 * 复用 collector session 的 GramJS 短连接（API / 测试页用）
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");

/**
 * @template T
 * @param {(client: TelegramClient) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withGramClient(fn) {
  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    const err = new Error("未找到 Telegram session，请先运行 npm run collector:login");
    err.code = "NO_SESSION";
    throw err;
  }

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { withGramClient, sleep };

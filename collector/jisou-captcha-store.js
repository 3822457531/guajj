/**
 * 极搜 web 验证码 pending 状态（测试页 / 多用户代点）
 * 生产环境建议换 Redis；此处内存 Map + TTL 足够联调
 */
const crypto = require("crypto");

/** @type {Map<string, object>} */
const pending = new Map();

const DEFAULT_TTL_MS = Math.max(
  30_000,
  Number(process.env.JISOU_CAPTCHA_CHALLENGE_TTL_MS) || 120_000
);

function purgeExpired() {
  const now = Date.now();
  for (const [id, row] of pending) {
    if (row.expiresAt <= now) pending.delete(id);
  }
}

/**
 * @param {object} data
 * @returns {string} challengeId
 */
function createChallenge(data) {
  purgeExpired();
  const challengeId = crypto.randomUUID();
  pending.set(challengeId, {
    ...data,
    createdAt: Date.now(),
    expiresAt: Date.now() + DEFAULT_TTL_MS
  });
  return challengeId;
}

/**
 * @param {string} challengeId
 */
function getChallenge(challengeId) {
  purgeExpired();
  const row = pending.get(challengeId);
  if (!row || row.expiresAt <= Date.now()) {
    pending.delete(challengeId);
    return null;
  }
  return row;
}

/**
 * @param {string} challengeId
 */
function consumeChallenge(challengeId) {
  const row = getChallenge(challengeId);
  if (row) pending.delete(challengeId);
  return row;
}

module.exports = { createChallenge, getChallenge, consumeChallenge, DEFAULT_TTL_MS };

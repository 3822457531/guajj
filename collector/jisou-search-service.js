/**
 * 极搜搜索 + 公开频道读消息（测试 / API 用）
 */
const { Api } = require("telegram/tl");
const { withGramClient, sleep } = require("./gram-client");
const { parseJisouSearchMessage, parseJisouReplyMarkup } = require("./jisou-parse");
const { pickContentType } = require("./parse");
const { mapRawMessage, groupMessagesForDisplay } = require("./message-display");
const { isJisouCaptcha, handleJisouCaptcha } = require("./jisou-captcha");

const BOT_USERNAME = (process.env.JISOU_BOT_USERNAME || "jisou").replace(/^@/, "");

function jisouReplyTimeoutMs() {
  const n = Number(process.env.JISOU_PROBE_TIMEOUT_MS ?? 18000);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 18000;
}

function normalizeUsername(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const m = raw.match(/(?:https?:\/\/)?t\.me\/([A-Za-z0-9_]+)/i);
  if (m) return m[1];
  return raw.replace(/^@/, "");
}

function mapGramError(err) {
  const msg = err?.errorMessage || err?.message || String(err);
  const code = err?.code || "";
  if (/SESSION_REVOKED/i.test(msg)) {
    return { code: "SESSION_REVOKED", message: "Telegram session 已失效，请重新 collector:login" };
  }
  if (/CHANNEL_PRIVATE|CHAT_ADMIN_REQUIRED|INVITE_HASH_EMPTY|CHANNEL_INVALID/i.test(msg)) {
    return {
      code: "CHANNEL_PRIVATE",
      message: "该频道/群为私有或需加入后才能读取，公开频道一般可不 join 直接读"
    };
  }
  if (/USERNAME_NOT_OCCUPIED|USERNAME_INVALID/i.test(msg)) {
    return { code: "USERNAME_INVALID", message: "频道用户名不存在或已改名" };
  }
  if (/FLOOD_WAIT_(\d+)/i.test(msg)) {
    const sec = Number(msg.match(/FLOOD_WAIT_(\d+)/i)?.[1] || 0);
    return { code: "FLOOD_WAIT", message: `请求过快，请 ${sec || "?"} 秒后重试`, retryAfterSec: sec };
  }
  if (String(code).startsWith("JISOU_CAPTCHA") || /JISOU_CAPTCHA|人机验证/i.test(msg)) {
    return { code: code || "JISOU_CAPTCHA_REQUIRED", message: msg || "极搜人机验证未通过" };
  }
  return { code: "GRAM_ERROR", message: msg };
}

async function waitForJisouReply(client, botEntity, afterMessageId, timeoutMs) {
  const botId = String(botEntity.id);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const batch = await client.getMessages(botEntity, { minId: afterMessageId, limit: 10 });
    const replies = (batch || [])
      .filter((m) => m?.id > afterMessageId)
      .sort((a, b) => a.id - b.id);

    for (const msg of replies) {
      try {
        const sender = await msg.getSender();
        if (sender && String(sender.id) === botId) return msg;
      } catch {
        /* ignore */
      }
    }
    await sleep(600);
  }

  const err = new Error("等待极搜回复超时");
  err.code = "JISOU_REPLY_TIMEOUT";
  throw err;
}

function buildJisouSearchResult(q, reply) {
  const text = reply.message || "";
  const parsed = parseJisouSearchMessage(text, reply.entities || []);
  const buttons = parseJisouReplyMarkup(reply.replyMarkup);
  return {
    query: q,
    replyMessageId: reply.id,
    ...parsed,
    buttons,
    fetchedAt: new Date().toISOString()
  };
}

/**
 * 向 @jisou 发关键词；若遇人机验证则自动/等待处理后重试
 * @param {string} query
 */
async function searchJisouChannels(query) {
  const q = String(query || "").trim();
  if (!q) return { query: "", channels: [], hotKeywords: [], ads: [], buttons: { filters: [], actions: [] } };

  return withGramClient(async (client) => {
    const botEntity = await client.getEntity(BOT_USERNAME);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const sent = await client.sendMessage(botEntity, { message: q });
      const reply = await waitForJisouReply(client, botEntity, sent.id, jisouReplyTimeoutMs());

      if (isJisouCaptcha(reply)) {
        console.log(`[极搜] 第 ${attempt} 次触发人机验证，开始处理…`);
        await handleJisouCaptcha(client, botEntity, reply);
        await sleep(1000);
        continue;
      }

      return buildJisouSearchResult(q, reply);
    }

    const err = new Error("极搜搜索在验证后仍未返回结果，请稍后重试");
    err.code = "JISOU_SEARCH_FAILED";
    throw err;
  });
}

/**
 * 读取频道消息（默认不 join；公开广播频道通常可直接读）
 * @param {string} usernameOrUrl
 * @param {{ limit?: number, search?: string, messageId?: number }} opts
 */
async function fetchChannelMessages(usernameOrUrl, opts = {}) {
  const username = normalizeUsername(usernameOrUrl);
  if (!username) {
    const err = new Error("请提供频道 username");
    err.code = "INVALID_USERNAME";
    throw err;
  }

  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  const search = String(opts.search || "").trim();
  const messageId = Number(opts.messageId) || 0;

  return withGramClient(async (client) => {
    let entity;
    try {
      entity = await client.getEntity(username);
    } catch (err) {
      const mapped = mapGramError(err);
      const e = new Error(mapped.message);
      e.code = mapped.code;
      throw e;
    }

    let entityType = entity.className || entity.constructor?.name || "Unknown";
    let broadcast = null;
    if (entity instanceof Api.Channel) {
      broadcast = Boolean(entity.broadcast);
      entityType = entity.broadcast ? "Channel (broadcast)" : "Channel (megagroup)";
    }

    let messages;
    try {
      if (messageId > 0) {
        messages = await client.getMessages(entity, { ids: [messageId] });
      } else {
        const getOpts = { limit };
        if (search) getOpts.search = search;
        messages = await client.getMessages(entity, getOpts);
      }
    } catch (err) {
      const mapped = mapGramError(err);
      const e = new Error(mapped.message);
      e.code = mapped.code;
      throw e;
    }

    const rawList = (messages || []).filter(Boolean).map((msg) => {
      msg._contentType = pickContentType(msg);
      return mapRawMessage(msg, username);
    });
    const displayList = groupMessagesForDisplay(rawList, username);

    return {
      username,
      entityType,
      broadcast,
      joinedRequired: false,
      note:
        broadcast === true
          ? "公开广播频道：GramJS 通常无需 join 即可读历史（与 TG 客户端预览一致）"
          : "超级群/私有频道：往往需要 join 后才能 getMessages",
      search: search || null,
      count: displayList.length,
      rawCount: rawList.length,
      messages: displayList,
      fetchedAt: new Date().toISOString()
    };
  });
}

/**
 * 下载单条消息的媒体（测试页预览用，优先缩略图）
 * @param {string} usernameOrUrl
 * @param {number} messageId
 * @param {{ thumb?: boolean }} opts
 */
async function downloadMessageMedia(usernameOrUrl, messageId, opts = {}) {
  const username = normalizeUsername(usernameOrUrl);
  const mid = Math.floor(Number(messageId));
  if (!username || mid <= 0) {
    const err = new Error("username 与 messageId 无效");
    err.code = "INVALID_PARAMS";
    throw err;
  }

  return withGramClient(async (client) => {
    const entity = await client.getEntity(username);
    const batch = await client.getMessages(entity, { ids: [mid] });
    const msg = batch?.[0];
    if (!msg?.media) {
      const err = new Error("该消息无媒体");
      err.code = "NO_MEDIA";
      throw err;
    }

    const contentType = pickContentType(msg);
    /** thumb=true 缩略图/封面；thumb=false 原图或完整视频；未指定时图片默认缩略图 */
    const wantThumb =
      opts.thumb === true ? true : opts.thumb === false ? false : contentType === "PHOTO";
    const downloadOpts = wantThumb ? { thumb: 1 } : {};
    const buffer = await client.downloadMedia(msg, downloadOpts);
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      const err = new Error("媒体下载失败");
      err.code = "DOWNLOAD_FAILED";
      throw err;
    }

    let mime = "application/octet-stream";
    if (wantThumb && contentType === "VIDEO") {
      mime = "image/jpeg";
    } else if (contentType === "PHOTO") {
      mime = "image/jpeg";
    } else if (contentType === "VIDEO") {
      const docMime = msg.media?.document?.mimeType || "";
      mime = docMime.startsWith("video/") ? docMime : "video/mp4";
    }

    return { buffer, mime, contentType, messageId: mid, username, thumb: wantThumb };
  });
}

module.exports = {
  searchJisouChannels,
  fetchChannelMessages,
  downloadMessageMedia,
  normalizeUsername,
  mapGramError
};

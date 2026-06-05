/**
 * 极搜搜索 + 公开频道读消息（测试 / API 用）
 */
const { Api } = require("telegram/tl");
const { withGramClient, sleep } = require("./gram-client");
const { parseJisouSearchMessage, parseJisouReplyMarkup } = require("./jisou-parse");
const { pickContentType } = require("./parse");
const { mapRawMessage, groupMessagesForDisplay } = require("./message-display");
const { isJisouCaptcha, handleJisouCaptcha } = require("./jisou-captcha");
const { cacheMessageMediaWithClient, mapPool } = require("./tg-search-media-cache");

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

/**
 * 列表返回前：在同一 GramJS 连接内预取封面缩略图并写入 R2/本地
 * 相册仅同步第一张 thumb，其余 lazy
 * @param {import('telegram').TelegramClient} client
 * @param {string} username
 * @param {object[]} displayList
 * @param {Map<number, import('telegram').Api.Message>} msgById
 */
async function enrichDisplayListWithThumbs(client, username, displayList, msgById) {
  const thumbJobs = [];

  for (const item of displayList) {
    item.coverUrl = null;
    item.mediaStatus = item.hasMedia ? "pending" : null;

    for (let i = 0; i < item.mediaItems.length; i++) {
      const mi = item.mediaItems[i];
      mi.thumbUrl = null;
      mi.fullUrl = null;
      mi.status = "pending";

      if (mi.contentType !== "PHOTO" && mi.contentType !== "VIDEO") continue;

      // 相册只同步预取封面，其余进 viewport 再拉
      if (item.kind === "album" && i > 0) continue;

      const msg = msgById.get(mi.id);
      if (!msg?.media) continue;
      thumbJobs.push({ item, mi, msg });
    }
  }

  const concurrency = Math.min(
    4,
    Math.max(1, Number(process.env.TG_SEARCH_THUMB_CONCURRENCY) || 3)
  );

  await mapPool(thumbJobs, concurrency, async ({ item, mi, msg }) => {
    try {
      const result = await cacheMessageMediaWithClient(client, username, msg, { thumb: true });
      mi.thumbUrl = result.url;
      mi.status = "thumb_ready";
      if (!item.coverUrl) item.coverUrl = result.url;
    } catch (err) {
      console.warn(
        `[tg-search:collector] thumb prefetch fail ${username}/${mi.id}: ${err?.message || err}`
      );
    }
  });

  for (const item of displayList) {
    if (!item.hasMedia) continue;
    const mediaOnly = item.mediaItems.filter(
      (m) => m.contentType === "PHOTO" || m.contentType === "VIDEO"
    );
    if (!mediaOnly.length) continue;

    const ready = mediaOnly.filter((m) => m.status === "thumb_ready" || m.status === "ready").length;
    if (ready === 0) item.mediaStatus = "pending";
    else if (ready >= mediaOnly.length) item.mediaStatus = "thumb_ready";
    else item.mediaStatus = "partial";
  }

  return displayList;
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

  console.log(`[tg-search:collector] ${new Date().toISOString()} searchJisouChannels start q=${JSON.stringify(q)}`);

  return withGramClient(async (client) => {
    const botEntity = await client.getEntity(BOT_USERNAME);
    console.log(`[tg-search:collector] bot @${BOT_USERNAME} entity ok`);
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[tg-search:collector] attempt ${attempt}/${maxAttempts} sendMessage`);
      const sent = await client.sendMessage(botEntity, { message: q });
      console.log(`[tg-search:collector] sent id=${sent.id}, wait reply timeout=${jisouReplyTimeoutMs()}ms`);
      const reply = await waitForJisouReply(client, botEntity, sent.id, jisouReplyTimeoutMs());

      if (isJisouCaptcha(reply)) {
        console.log(`[tg-search:collector] 第 ${attempt} 次触发人机验证，开始处理…`);
        await handleJisouCaptcha(client, botEntity, reply);
        await sleep(1000);
        continue;
      }

      const result = buildJisouSearchResult(q, reply);
      console.log(`[tg-search:collector] search ok channels=${result.channels?.length ?? 0} replyId=${reply.id}`);
      return result;
    }

    const err = new Error("极搜搜索在验证后仍未返回结果，请稍后重试");
    err.code = "JISOU_SEARCH_FAILED";
    throw err;
  });
}

/**
 * 极搜定位：拉取目标消息 + 相册 siblings + 少量上下文（对齐 TG 点击跳转）
 * @param {import('telegram').TelegramClient} client
 * @param {import('telegram').Api.TypeEntityLike} entity
 * @param {number} anchorId
 * @param {number} limit
 */
async function fetchMessagesAroundAnchor(client, entity, anchorId, limit = 20) {
  const anchorBatch = await client.getMessages(entity, { ids: [anchorId] });
  const anchor = anchorBatch?.[0];
  if (!anchor) {
    const err = new Error(`消息 #${anchorId} 不存在或无法读取`);
    err.code = "MESSAGE_NOT_FOUND";
    throw err;
  }

  const collected = new Map();
  collected.set(anchor.id, anchor);

  if (anchor.groupedId != null) {
    const around = await client.getMessages(entity, {
      minId: Math.max(1, anchorId - 40),
      maxId: anchorId + 40
    });
    for (const m of around || []) {
      if (m?.groupedId != null && String(m.groupedId) === String(anchor.groupedId)) {
        collected.set(m.id, m);
      }
    }
  }

  const remaining = Math.max(0, limit - collected.size);
  if (remaining > 0) {
    const older = await client.getMessages(entity, { offsetId: anchorId, limit: remaining });
    for (const m of older || []) {
      if (m?.id && !collected.has(m.id)) collected.set(m.id, m);
    }
  }

  const messages = Array.from(collected.values()).sort((a, b) => b.id - a.id);
  return { messages, anchorId };
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
  const anchorMessageId = !search && messageId > 0 ? messageId : null;

  console.log(
    `[tg-search:collector] ${new Date().toISOString()} fetchChannelMessages username=${JSON.stringify(username)} limit=${limit} search=${JSON.stringify(search || null)} anchor=${anchorMessageId || "none"}`
  );

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
      if (search) {
        messages = await client.getMessages(entity, { limit, search });
      } else if (anchorMessageId) {
        const anchored = await fetchMessagesAroundAnchor(client, entity, anchorMessageId, limit);
        messages = anchored.messages;
      } else {
        messages = await client.getMessages(entity, { limit });
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

    if (anchorMessageId) {
      for (const item of displayList) {
        item.isAnchor =
          item.id === anchorMessageId ||
          (Array.isArray(item.ids) && item.ids.includes(anchorMessageId));
      }
    }

    const msgById = new Map();
    for (const msg of messages || []) {
      if (msg?.id) msgById.set(msg.id, msg);
    }

    await enrichDisplayListWithThumbs(client, username, displayList, msgById);

    console.log(
      `[tg-search:collector] fetchChannelMessages ok username=${username} raw=${rawList.length} display=${displayList.length}`
    );

    return {
      username,
      entityType,
      broadcast,
      joinedRequired: false,
      note:
        broadcast === true
          ? anchorMessageId
            ? `已定位极搜结果 #${anchorMessageId}（含相册/上下文）。封面缩略图预缓存至 R2/本地。`
            : "公开广播频道：GramJS 通常无需 join 即可读历史。封面缩略图已预缓存至 R2/本地，相册其余图与视频原文件按需加载。"
          : "超级群/私有频道：往往需要 join 后才能 getMessages",
      search: search || null,
      anchorMessageId,
      count: displayList.length,
      rawCount: rawList.length,
      messages: displayList,
      fetchedAt: new Date().toISOString()
    };
  });
}

/**
 * 按需解析媒体：先读 R2/本地缓存，未命中则 GramJS 下载并写穿缓存
 * @param {string} usernameOrUrl
 * @param {number} messageId
 * @param {{ thumb?: boolean }} opts
 */
async function resolveMessageMedia(usernameOrUrl, messageId, opts = {}) {
  const username = normalizeUsername(usernameOrUrl);
  const mid = Math.floor(Number(messageId));
  if (!username || mid <= 0) {
    const err = new Error("username 与 messageId 无效");
    err.code = "INVALID_PARAMS";
    throw err;
  }

  const wantThumb = opts.thumb !== false;
  const variant = wantThumb ? "thumb" : "full";
  const { getCachedMediaUrl, buildMediaSubPath, singleflight } = require("./tg-search-media-cache");

  for (const contentType of ["PHOTO", "VIDEO"]) {
    const subPath = buildMediaSubPath(username, mid, variant, contentType);
    const cachedUrl = await getCachedMediaUrl(subPath);
    if (cachedUrl) {
      return {
        url: cachedUrl,
        cached: true,
        mime: wantThumb ? "image/jpeg" : contentType === "VIDEO" ? "video/mp4" : "image/jpeg",
        contentType,
        messageId: mid,
        username,
        thumb: wantThumb,
        buffer: null
      };
    }
  }

  const flightKey = `resolve:${username}:${mid}:${variant}`;

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

      const result = await cacheMessageMediaWithClient(client, username, msg, opts);
      return {
        url: result.url,
        cached: result.cached,
        mime: result.mime || (wantThumb ? "image/jpeg" : "application/octet-stream"),
        contentType: result.contentType,
        messageId: mid,
        username,
        thumb: wantThumb,
        buffer: result.buffer || null
      };
    })
  );
}

/** @deprecated 请用 resolveMessageMedia；仅保留类型兼容 */
async function downloadMessageMedia(usernameOrUrl, messageId, opts = {}) {
  return resolveMessageMedia(usernameOrUrl, messageId, opts);
}

module.exports = {
  searchJisouChannels,
  fetchChannelMessages,
  resolveMessageMedia,
  downloadMessageMedia,
  normalizeUsername,
  mapGramError
};

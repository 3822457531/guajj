/**
 * 极搜搜索 + 公开频道读消息（测试 / API 用）
 */
const { Api } = require("telegram/tl");
const { withGramClient, sleep } = require("./gram-client");
const { parseJisouSearchMessage, parseJisouReplyMarkup } = require("./jisou-parse");
const { pickContentType } = require("./parse");
const { mapRawMessage, groupMessagesForDisplay } = require("./message-display");
const {
  isJisouCaptcha,
  handleJisouCaptcha,
  packCaptchaForWeb,
  captchaMode,
  flattenCallbackButtons,
  captchaMediaSignature
} = require("./jisou-captcha");
const { consumeChallenge, getChallenge } = require("./jisou-captcha-store");
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
    return { code: "SESSION_REVOKED", message: "采集通道已失效，请重新登录采集号" };
  }
  if (/AUTH_KEY_DUPLICATED/i.test(msg)) {
    return {
      code: "SESSION_BUSY",
      message: "采集通道正忙（请勿同时多窗口搜索，或停止后台采集进程后重试）"
    };
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

function thumbPrefetchConcurrency() {
  const maxCap = Math.min(16, Math.max(4, Number(process.env.TG_SEARCH_THUMB_MAX) || 12));
  const n = Number(process.env.TG_SEARCH_THUMB_CONCURRENCY) || 8;
  return Math.min(maxCap, Math.max(1, Math.round(n)));
}

/**
 * 列表返回前：在同一 GramJS 连接内预取封面缩略图并写入 R2/本地
 * 相册内全部缩略图并发预取，展开相册无需再等
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

      const msg = msgById.get(mi.id);
      if (!msg?.media) continue;
      thumbJobs.push({ item, mi, msg });
    }
  }

  const concurrency = thumbPrefetchConcurrency();
  console.log(
    `[tg-search:collector] thumb prefetch jobs=${thumbJobs.length} concurrency=${concurrency}`
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
    const batch = await client.getMessages(botEntity, { minId: afterMessageId, limit: 15 });
    const replies = (batch || [])
      .filter((m) => m?.id > afterMessageId)
      .sort((a, b) => a.id - b.id);

    for (const msg of replies) {
      // 首条 bot 回复可能是验证码，也必须返回（不可 skip）
      try {
        const sender = await msg.getSender();
        if (sender && String(sender.id) === botId) return msg;
      } catch {
        if (!msg.out) return msg;
      }
    }
    await sleep(600);
  }

  const err = new Error("等待极搜回复超时");
  err.code = "JISOU_REPLY_TIMEOUT";
  throw err;
}

/** 极搜搜索结果消息（含频道列表或热搜，非验证码） */
function isLikelyJisouSearchReply(msg) {
  if (!msg || isJisouCaptcha(msg)) return false;
  const text = String(msg.message || "");
  if (/📢|热搜[：:]/u.test(text)) return true;
  const parsed = parseJisouSearchMessage(text, msg.entities || []);
  return parsed.channelCount > 0 || parsed.hotKeywords.length > 0;
}

function captchaOptionsSignature(msg) {
  return flattenCallbackButtons(msg)
    .map((b) => String(b.text ?? "").trim())
    .filter((t) => /^\d+$/.test(t))
    .sort()
    .join(",");
}

async function throwWebCaptchaRetry(client, botEntity, captchaMsg, q, sentMessageId, message) {
  const captcha = await packCaptchaForWeb(client, botEntity, captchaMsg, q, sentMessageId);
  const err = new Error(message || "答案错误，请根据新题目重新选择");
  err.code = "JISOU_CAPTCHA_REQUIRED";
  err.captcha = captcha;
  err.query = q;
  throw err;
}

/**
 * 用户代点验证码后：优先等搜索结果；若极搜刷出新验证码（答错/重试）则立即返回
 */
async function waitAfterCaptchaAnswer(client, botEntity, challenge) {
  const captchaMsgId = Number(challenge.captchaMsgId) || 0;
  const sentMessageId = Number(challenge.sentMessageId) || 0;
  const afterId = Math.max(captchaMsgId, sentMessageId);
  const knownSig = (challenge.options || []).slice().sort().join(",");
  const knownMediaSig = String(challenge.captchaMediaSig || "");
  const timeoutMs = jisouReplyTimeoutMs();
  const deadline = Date.now() + timeoutMs;
  const minRetryCheckAt = Date.now() + 600;

  while (Date.now() < deadline) {
    const [fresh] = await client.getMessages(botEntity, { ids: [captchaMsgId] });

    if (fresh && isJisouCaptcha(fresh)) {
      const text = String(fresh.message || "");
      const sig = captchaOptionsSignature(fresh);
      const mediaSig = captchaMediaSignature(fresh);
      const failedHint = /验证失败|重新尝试|retry/i.test(text);
      const optionsChanged = Boolean(sig && knownSig && sig !== knownSig);
      const mediaChanged = Boolean(knownMediaSig && mediaSig && mediaSig !== knownMediaSig);
      if (Date.now() >= minRetryCheckAt && (failedHint || optionsChanged || mediaChanged)) {
        console.log(
          `[tg-search:collector] captcha 未通过，极搜已刷题 msgId=${fresh.id} failedHint=${failedHint} optionsChanged=${optionsChanged} mediaChanged=${mediaChanged}`
        );
        return { kind: "captcha", msg: fresh };
      }
    }

    const batch = await client.getMessages(botEntity, { minId: afterId, limit: 15 });
    const candidates = (batch || [])
      .filter((m) => m?.id > afterId && !m.out)
      .sort((a, b) => b.id - a.id);

    for (const msg of candidates) {
      if (isLikelyJisouSearchReply(msg)) {
        return { kind: "search", msg };
      }
      if (msg.id > captchaMsgId && isJisouCaptcha(msg)) {
        console.log(`[tg-search:collector] captcha 后出现新验证消息 msgId=${msg.id}`);
        return { kind: "captcha", msg };
      }
    }

    await sleep(500);
  }

  return { kind: "timeout" };
}

/**
 * 验证码通过后拉取搜索结果：先扫近期消息，必要时重发关键词
 */
async function fetchJisouSearchAfterCaptcha(client, botEntity, q, afterMessageId) {
  const timeoutMs = jisouReplyTimeoutMs();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const batch = await client.getMessages(botEntity, { minId: afterMessageId, limit: 15 });
    const candidates = (batch || [])
      .filter((m) => m?.id > afterMessageId && !m.out)
      .sort((a, b) => b.id - a.id);

    for (const msg of candidates) {
      if (isLikelyJisouSearchReply(msg)) {
        console.log(`[tg-search:collector] captcha 后命中搜索结果 msgId=${msg.id}`);
        return msg;
      }
    }
    await sleep(700);
  }

  console.log(`[tg-search:collector] captcha 后未扫到结果，重发关键词 q=${JSON.stringify(q)}`);
  const sent = await client.sendMessage(botEntity, { message: q });
  const reply = await waitForJisouReply(client, botEntity, sent.id, timeoutMs);
  if (isJisouCaptcha(reply)) {
    const captcha = await packCaptchaForWeb(client, botEntity, reply, q, sent.id);
    const err = new Error("验证未通过或需要再次验证，请重试");
    err.code = "JISOU_CAPTCHA_REQUIRED";
    err.captcha = captcha;
    err.query = q;
    throw err;
  }
  return reply;
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
 * 向 @jisou 发关键词；若遇人机验证则自动/等待/web 交给前端
 * @param {string} query
 * @param {{ webCaptcha?: boolean }} opts — API 测试页传 webCaptcha:true 强制网页验证码
 */
async function searchJisouChannels(query, opts = {}) {
  const q = String(query || "").trim();
  if (!q) return { query: "", channels: [], hotKeywords: [], ads: [], buttons: { filters: [], actions: [] } };

  const deliverWebCaptcha = opts.webCaptcha === true || captchaMode() === "web";

  console.log(
    `[tg-search:collector] ${new Date().toISOString()} searchJisouChannels start q=${JSON.stringify(q)} webCaptcha=${deliverWebCaptcha}`
  );

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
        if (deliverWebCaptcha) {
          console.log(`[tg-search:collector] 人机验证 → 打包给网页用户（不阻塞 wait/auto）`);
          const captcha = await packCaptchaForWeb(client, botEntity, reply, q, sent.id);
          const err = new Error("极搜需要人机验证，请由网页用户选择正确答案");
          err.code = "JISOU_CAPTCHA_REQUIRED";
          err.captcha = captcha;
          err.query = q;
          throw err;
        }
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
 * 用户提交验证码答案后继续极搜
 * @param {string} challengeId
 * @param {string} answer
 */
async function solveJisouCaptchaAndSearch(challengeId, answer) {
  const challenge = consumeChallenge(challengeId);
  if (!challenge) {
    const err = new Error("验证码已过期或不存在，请重新搜索");
    err.code = "JISOU_CAPTCHA_EXPIRED";
    throw err;
  }

  const q = String(challenge.query || "").trim();
  if (!q) {
    const err = new Error("验证码缺少关联搜索词");
    err.code = "JISOU_CAPTCHA_INVALID";
    throw err;
  }

  const { submitWebCaptchaAnswer } = require("./jisou-captcha");

  return withGramClient(async (client) => {
    const botEntity = await client.getEntity(BOT_USERNAME);
    await submitWebCaptchaAnswer(client, botEntity, challenge, answer);
    await sleep(800);

    const post = await waitAfterCaptchaAnswer(client, botEntity, challenge);

    if (post.kind === "captcha") {
      await throwWebCaptchaRetry(
        client,
        botEntity,
        post.msg,
        q,
        challenge.sentMessageId,
        "答案错误或未通过，请根据新题目重新选择"
      );
    }

    if (post.kind === "search") {
      const result = buildJisouSearchResult(q, post.msg);
      console.log(
        `[tg-search:collector] captcha solved, search ok channels=${result.channels?.length ?? 0} replyId=${post.msg.id}`
      );
      return result;
    }

    // 超时：若原验证码消息仍存在，优先刷题给用户，避免误重发关键词
    const [stale] = await client.getMessages(botEntity, { ids: [challenge.captchaMsgId] });
    if (stale && isJisouCaptcha(stale)) {
      const sig = captchaOptionsSignature(stale);
      const knownSig = (challenge.options || []).slice().sort().join(",");
      const knownMediaSig = String(challenge.captchaMediaSig || "");
      const mediaSig = captchaMediaSignature(stale);
      const failedHint = /验证失败|重新尝试|retry/i.test(String(stale.message || ""));
      const refreshed = failedHint || sig !== knownSig || (knownMediaSig && mediaSig !== knownMediaSig);
      await throwWebCaptchaRetry(
        client,
        botEntity,
        stale,
        q,
        challenge.sentMessageId,
        refreshed ? "答案错误或未通过，请根据新题目重新选择" : "验证未完成，请重新选择正确答案"
      );
    }

    const afterId = Math.max(Number(challenge.captchaMsgId) || 0, Number(challenge.sentMessageId) || 0);
    const reply = await fetchJisouSearchAfterCaptcha(client, botEntity, q, afterId);
    const result = buildJisouSearchResult(q, reply);
    console.log(
      `[tg-search:collector] captcha solved (late), search ok channels=${result.channels?.length ?? 0} replyId=${reply.id}`
    );
    return result;
  });
}

/**
 * @param {string} challengeId
 */
function getJisouCaptchaImage(challengeId) {
  const row = getChallenge(challengeId);
  if (!row?.imageBuffer) return null;
  return { buffer: row.imageBuffer, mime: "image/jpeg" };
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
            ? `已定位索引结果 #${anchorMessageId}（含相册/上下文）。封面已预缓存。`
            : "公开频道：可直接预览历史。封面已并发预缓存，视频按需加载。"
          : "超级群/私有频道：往往需要加入后才能读取",
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
  solveJisouCaptchaAndSearch,
  getJisouCaptchaImage,
  fetchChannelMessages,
  resolveMessageMedia,
  downloadMessageMedia,
  normalizeUsername,
  mapGramError
};

/**
 * 解析 @jisou 极搜 bot 私聊搜索回复（基于实测消息格式）
 */

function lineAtOffset(text, offset) {
  const start = Math.max(0, text.lastIndexOf("\n", offset - 1) + 1);
  const endIdx = text.indexOf("\n", offset);
  const end = endIdx === -1 ? text.length : endIdx;
  return text.slice(start, end);
}

function parseMemberCount(line) {
  const m = String(line).match(/(\d+(?:\.\d+)?[kK万]?)\s*$/);
  return m ? m[1] : null;
}

function parseTelegramUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname !== "t.me" && u.hostname !== "telegram.me") return null;
    const path = u.pathname.replace(/^\//, "");
    if (!path) return null;
    const [slug, postId] = path.split("/");
    return {
      username: slug.startsWith("+") ? null : slug,
      inviteSlug: slug.startsWith("+") ? slug : null,
      postId: postId ? Number(postId) : null,
      isAd: u.search.includes("ad=")
    };
  } catch {
    return null;
  }
}

function isJisouHotSearchUrl(url) {
  return /jisou1Bot\?start=/i.test(url) || /jisou\?start=s_/i.test(url);
}

function isChannelResultUrl(url) {
  const parsed = parseTelegramUrl(url);
  if (!parsed || parsed.isAd) return false;
  if (isJisouHotSearchUrl(url)) return false;
  return Boolean(parsed.username || parsed.inviteSlug);
}

function decodeCallbackData(data) {
  if (!data) return null;
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (typeof data === "string" && /^[0-9a-f]+$/i.test(data) && data.length % 2 === 0) {
    try {
      return Buffer.from(data, "hex").toString("utf8");
    } catch {
      return data;
    }
  }
  return String(data);
}

/**
 * @param {string} text 消息正文
 * @param {Array<{ className?: string, offset?: number, length?: number, url?: string }>} entities
 */
function parseJisouSearchMessage(text, entities = []) {
  const channels = [];
  const hotKeywords = [];
  const ads = [];

  for (const ent of entities) {
    if (ent.className !== "MessageEntityTextUrl" || !ent.url) continue;

    const label = text.slice(ent.offset, ent.offset + ent.length);
    const url = ent.url;

    if (parseTelegramUrl(url)?.isAd) {
      ads.push({ label: label.trim(), url });
      continue;
    }

    if (isJisouHotSearchUrl(url)) {
      hotKeywords.push({ label: label.trim(), url });
      continue;
    }

    if (!isChannelResultUrl(url)) continue;

    const line = lineAtOffset(text, ent.offset);
    const members = parseMemberCount(line);
    const titleFromLine = line.replace(/^📢\s*/, "").replace(/\s+\d+(?:\.\d+)?[kK万]?\s*$/, "").trim();
    const parsed = parseTelegramUrl(url);

    channels.push({
      title: titleFromLine || label.replace(/^📢\s*/, "").trim(),
      label: label.trim(),
      url,
      username: parsed?.username || null,
      members
    });
  }

  const hotSearchLine = text.match(/热搜[：:]\s*(.+)/);
  const hotSearchText = hotSearchLine ? hotSearchLine[1].trim() : null;

  return {
    channels,
    hotKeywords,
    ads,
    hotSearchText,
    channelCount: channels.length
  };
}

/**
 * @param {{ rows?: Array<Array<{ className?: string, text?: unknown, data?: Buffer|string, url?: string }>> }} markup
 */
function parseJisouReplyMarkup(markup) {
  if (!markup?.rows) return { filters: [], actions: [] };

  const filters = [];
  const actions = [];

  for (const row of markup.rows) {
    for (const btn of row.buttons || row) {
      const text = String(btn.text ?? "");
      const item = {
        text,
        className: btn.className,
        url: btn.url || null,
        callback: btn.data ? decodeCallbackData(btn.data) : null
      };
      if (btn.className === "KeyboardButtonCallback") {
        if (/下一页|上一页|最新|过滤/.test(text) || text.length > 2) {
          actions.push(item);
        } else {
          filters.push(item);
        }
      }
    }
  }

  return { filters, actions };
}

module.exports = {
  parseJisouSearchMessage,
  parseJisouReplyMarkup,
  decodeCallbackData,
  parseTelegramUrl
};

const { messageToIndexPayload, getMessageText, parseContent, pickContentType } = require("./parse");
const { downloadIndexedMedia } = require("./media-download");

function buildIndexContentBlocks(payload) {
  const blocks = [];
  const body = (payload.rawText || "").trim();
  if (body && body !== "(无文字)" && body !== "无标题" && body !== payload.title) {
    blocks.push({ type: "text", text: body });
  }

  const imageUrls = [];
  if (payload.mediaUrl && payload.contentType === "PHOTO") imageUrls.push(payload.mediaUrl);
  if (payload.galleryImageUrls) {
    try {
      const extras = JSON.parse(payload.galleryImageUrls);
      if (Array.isArray(extras)) {
        for (const u of extras) {
          if (typeof u === "string" && u && !imageUrls.includes(u)) imageUrls.push(u);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const videoUrls = [];
  if (payload.mediaUrl && payload.contentType === "VIDEO") videoUrls.push(payload.mediaUrl);
  if (payload.galleryVideoUrls) {
    try {
      const extras = JSON.parse(payload.galleryVideoUrls);
      if (Array.isArray(extras)) {
        for (const u of extras) {
          if (typeof u === "string" && u && !videoUrls.includes(u)) videoUrls.push(u);
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const src of videoUrls) blocks.push({ type: "video", src });
  if (imageUrls.length) blocks.push({ type: "images", urls: imageUrls });
  return blocks.length ? JSON.stringify(blocks) : null;
}

/**
 * 相册多图/多视频合并为一条索引（leader = 最小 messageId 或带 caption 的那条）
 * @param {import('telegram').TelegramClient} client
 * @param {{ msg: import('telegram').Api.Message }[]} items
 * @param {string} chatId
 * @param {{ title?: string; username?: string }} source
 */
async function buildAlbumPayload(client, items, chatId, source = {}) {
  items.sort((a, b) => a.msg.id - b.msg.id);

  const withCaption = items.find((x) => getMessageText(x.msg).length > 0);
  const leaderMsg = (withCaption || items[0]).msg;

  let rawText = getMessageText(leaderMsg);
  for (const item of items) {
    if (item.msg.id === leaderMsg.id) continue;
    const t = getMessageText(item.msg);
    if (!t) continue;
    if (rawText && !rawText.includes(t.slice(0, 80))) rawText += `\n\n${t}`;
    else if (!rawText) rawText = t;
  }

  const parsed = parseContent(rawText || "");
  const imageUrls = [];
  const videoUrls = [];

  for (const item of items) {
    const contentType = pickContentType(item.msg);
    if (contentType !== "PHOTO" && contentType !== "VIDEO") continue;
    const url = await downloadIndexedMedia(client, item.msg, {
      chatId,
      messageId: item.msg.id,
      contentType
    });
    if (!url) continue;
    if (contentType === "PHOTO") imageUrls.push(url);
    else videoUrls.push(url);
  }

  let contentType = "TEXT";
  if (imageUrls.length) contentType = "PHOTO";
  else if (videoUrls.length) contentType = "VIDEO";

  let title = parsed.title;
  if (title === "无标题" || !title) {
    if (imageUrls.length > 1) title = `${source.title || "相册"} · ${imageUrls.length}张图片`;
    else if (imageUrls.length === 1) title = `${source.title || "图片"}`;
    else if (videoUrls.length > 1) title = `${source.title || "相册"} · ${videoUrls.length}个视频`;
    else if (videoUrls.length === 1) title = `${source.title || "视频"}`;
    else title = source.title || "无标题";
  }

  const payload = {
    messageId: leaderMsg.id,
    messageDate: leaderMsg.date ? new Date(leaderMsg.date * 1000) : new Date(),
    contentType,
    title: title.slice(0, 500),
    snippet: (parsed.snippet || title).slice(0, 2000),
    rawText: (parsed.body || rawText || title).slice(0, 65000),
    sourceTitle: source.title ?? null,
    sourceUsername: source.username ?? null,
    durationSec: null,
    mediaUrl: null,
    galleryImageUrls: null,
    galleryVideoUrls: null,
    mediaGroupId: leaderMsg.groupedId != null ? String(leaderMsg.groupedId) : null,
    contentBlocks: null
  };

  if (imageUrls.length && videoUrls.length) {
    payload.mediaUrl = imageUrls[0];
    payload.galleryImageUrls = imageUrls.length > 1 ? JSON.stringify(imageUrls.slice(1)) : null;
    payload.galleryVideoUrls = JSON.stringify(videoUrls);
    payload.contentType = "PHOTO";
  } else if (imageUrls.length) {
    payload.mediaUrl = imageUrls[0];
    payload.galleryImageUrls = imageUrls.length > 1 ? JSON.stringify(imageUrls.slice(1)) : null;
  } else if (videoUrls.length) {
    payload.mediaUrl = videoUrls[0];
    payload.galleryVideoUrls = videoUrls.length > 1 ? JSON.stringify(videoUrls.slice(1)) : null;
    payload.contentType = "VIDEO";
  }

  payload.contentBlocks = buildIndexContentBlocks(payload);
  return payload;
}

/**
 * 单条消息：下载媒体并填充 gallery / contentBlocks
 */
async function attachMediaFields(client, msg, payload, chatId) {
  payload.galleryImageUrls = null;
  payload.galleryVideoUrls = null;

  if (payload.contentType === "PHOTO" || payload.contentType === "VIDEO") {
    const url = await downloadIndexedMedia(client, msg, {
      chatId,
      messageId: payload.messageId,
      contentType: payload.contentType
    });
    if (url) payload.mediaUrl = url;
  }

  payload.contentBlocks = buildIndexContentBlocks(payload);
  return payload;
}

module.exports = { buildAlbumPayload, attachMediaFields, buildIndexContentBlocks };

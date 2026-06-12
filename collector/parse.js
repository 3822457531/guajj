/** 从 GramJS 消息解析为索引字段（与 lib/telegram.ts 规则尽量一致） */

const REPOST_LINE = /^【转自[^\]]*】\s*$/;

function stripRepost(text) {
  return text
    .split(/\r?\n/)
    .filter((line) => !REPOST_LINE.test(line.trim()))
    .join("\n")
    .trim();
}

function getMessageText(msg) {
  return (msg.message || msg.text || "").trim();
}

function pickContentType(msg) {
  const media = msg.media;
  if (!media) return "TEXT";
  const cls = media.className || media.constructor?.name || "";
  if (cls.includes("Video") || cls === "MessageMediaDocument") {
    const mime = media.document?.mimeType || media.mimeType || "";
    const name = media.document?.attributes?.find?.((a) => a.fileName)?.fileName || "";
    if (mime.startsWith("video/") || /\.(mp4|mov|mkv|webm)$/i.test(name)) return "VIDEO";
    if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(name)) return "PHOTO";
    if (cls.includes("Document") || cls === "MessageMediaDocument") return "DOCUMENT";
  }
  if (cls.includes("Photo") || cls === "MessageMediaPhoto") return "PHOTO";
  if (cls.includes("Document")) return "DOCUMENT";
  return "TEXT";
}

function getDurationSec(msg) {
  const media = msg.media;
  if (!media?.document?.attributes) return null;
  for (const attr of media.document.attributes) {
    if (attr.className === "DocumentAttributeVideo" || attr.duration != null) {
      return Math.round(Number(attr.duration) || 0) || null;
    }
  }
  return null;
}

function parseContent(rawText) {
  const cleaned = stripRepost(rawText);
  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { title: "无标题", snippet: "", body: "" };
  }
  const title = lines[0].slice(0, 80);
  const summary = (lines[1] || lines[0].slice(0, 140)).slice(0, 140);
  return { title, snippet: summary, body: lines.join("\n") };
}

/**
 * @param {import('telegram').Api.Message} msg
 * @param {{ title?: string; username?: string }} source
 */
function messageToIndexPayload(msg, source = {}) {
  const rawText = getMessageText(msg);
  const parsed = parseContent(rawText || "(无文字)");
  const date = msg.date ? new Date(msg.date * 1000) : new Date();

  return {
    messageId: msg.id,
    messageDate: date,
    contentType: pickContentType(msg),
    title: parsed.title,
    snippet: parsed.snippet,
    rawText: parsed.body || rawText || parsed.title,
    sourceTitle: source.title ?? null,
    sourceUsername: source.username ?? null,
    durationSec: getDurationSec(msg),
    mediaUrl: null,
    mediaGroupId: msg.groupedId != null ? String(msg.groupedId) : null
  };
}

function peerIdToChatId(peerId) {
  if (peerId == null) return null;
  if (typeof peerId === "bigint") return peerId.toString();
  return String(peerId);
}

module.exports = {
  getMessageText,
  messageToIndexPayload,
  peerIdToChatId,
  parseContent,
  pickContentType,
  getDurationSec
};

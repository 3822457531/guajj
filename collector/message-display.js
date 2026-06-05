/**
 * 将 GramJS 原始消息列表整理为前台展示结构（合并相册、补全 caption）
 */

function mapRawMessage(msg, username) {
  const text = (msg.message || msg.text || "").trim();
  const contentType = msg._contentType || "TEXT";
  return {
    id: msg.id,
    date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
    text,
    textPreview: text.slice(0, 160),
    contentType,
    hasMedia: Boolean(msg.media),
    groupedId: msg.groupedId != null ? String(msg.groupedId) : null,
    permalink: `https://t.me/${username}/${msg.id}`
  };
}

/**
 * 相册 groupedId 相同：TG 只在其中一条上挂 caption，其余条 message 为空但含 media
 * @param {ReturnType<typeof mapRawMessage>[]} items newest-first
 */
function groupMessagesForDisplay(items, username) {
  const seenGroups = new Set();
  const display = [];

  for (const msg of items) {
    const gid = msg.groupedId;
    if (gid) {
      if (seenGroups.has(gid)) continue;
      seenGroups.add(gid);

      const albumItems = items
        .filter((m) => m.groupedId === gid)
        .sort((a, b) => a.id - b.id);

      const caption = albumItems.map((m) => m.text).find(Boolean) || "";
      const mediaItems = albumItems
        .filter((m) => m.hasMedia)
        .map((m) => ({ id: m.id, contentType: m.contentType }));

      display.push({
        kind: "album",
        id: albumItems[0].id,
        ids: albumItems.map((m) => m.id),
        date: albumItems[0].date,
        caption,
        textPreview: caption.slice(0, 200) || `相册 ${mediaItems.length || albumItems.length} 项（无配文）`,
        contentType: "ALBUM",
        hasMedia: mediaItems.length > 0,
        mediaItems,
        albumSize: albumItems.length,
        permalink: `https://t.me/${username}/${albumItems[albumItems.length - 1].id}`
      });
      continue;
    }

    display.push({
      kind: "single",
      id: msg.id,
      ids: [msg.id],
      date: msg.date,
      caption: msg.text,
      textPreview:
        msg.textPreview ||
        (msg.hasMedia ? (msg.contentType === "VIDEO" ? "[视频]" : "[图片]") : "(无文字)"),
      contentType: msg.contentType,
      hasMedia: msg.hasMedia,
      mediaItems: msg.hasMedia ? [{ id: msg.id, contentType: msg.contentType }] : [],
      albumSize: 1,
      permalink: msg.permalink
    });
  }

  return display;
}

module.exports = { mapRawMessage, groupMessagesForDisplay };

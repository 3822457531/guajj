/**
 * 统一频道 chatId（与 Bot API / GramJS 事件一致：-100 + channelId）
 */
function normalizeChatId(raw) {
  if (raw == null || raw === "") return null;
  const s = typeof raw === "bigint" ? raw.toString() : String(raw).trim();

  if (s.startsWith("-100")) return s;

  // GramJS 部分场景为 -1768480205
  if (s.startsWith("-") && !s.startsWith("-100")) {
    const n = s.slice(1);
    if (/^\d+$/.test(n)) return `-100${n}`;
    return s;
  }

  // sync 时误存的裸 channelId：1768480205
  if (/^\d+$/.test(s)) return `-100${s}`;

  return s;
}

/** @param {import('telegram').EntityLike} entity */
function entityToChatId(entity) {
  if (!entity) return null;
  try {
    const { utils } = require("telegram");
    const peerId = utils.getPeerId(entity, false);
    return normalizeChatId(peerId);
  } catch {
    if (entity.id != null) return normalizeChatId(entity.id);
    return null;
  }
}

module.exports = { normalizeChatId, entityToChatId };

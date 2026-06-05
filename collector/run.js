/**
 * 长期监听源频道新消息 → 写入 TgIndexedMessage
 * 用法: npm run collector
 *
 * 环境变量:
 *   TG_COLLECTOR_POLL_MS — 轮询间隔（毫秒），默认 90000；设为 0 关闭轮询
 *   TG_COLLECTOR_DEBUG — 设为 1 时打印跳过历史消息的日志
 *   TG_COLLECTOR_TZ — 日志时间显示时区，默认 Asia/Shanghai（东八区）
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { requireEnv, readSession } = require("./config");
const { messageToIndexPayload, peerIdToChatId } = require("./parse");
const { normalizeChatId } = require("./chat-id");
const { buildAlbumPayload, attachMediaFields } = require("./album-merge");
const { isMediaDownloadEnabled } = require("./media-download");
const { createPrisma, upsertIndexedMessage } = require("../lib/tg-index-ingest");
const {
  messageDateFromMsg,
  isNewerThanFloor,
  loadLastIndexedDates,
  bumpLastIndexedDate
} = require("./ingest-guard");
const { collectorTimezone, formatCollectorTime } = require("./format-time");

const collectorDebug = () =>
  (process.env.TG_COLLECTOR_DEBUG || "").trim() === "1";

function collectorPollMs() {
  const n = Number(process.env.TG_COLLECTOR_POLL_MS ?? 90000);
  if (!Number.isFinite(n) || n < 0) return 90000;
  return Math.round(n);
}

async function loadSources(prisma) {
  return prisma.tgSourceChannel.findMany({
    where: { isEnabled: true, chatId: { not: null } }
  });
}

async function main() {
  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    throw new Error("未找到 session，请先运行: npm run collector:login");
  }

  const prisma = createPrisma();
  const sources = await loadSources(prisma);
  if (sources.length === 0) {
    throw new Error("没有已启用的源频道。请编辑 collector/channels.json 后执行 npm run collector:sync-channels");
  }

  const chatIdSet = new Set(sources.map((s) => normalizeChatId(s.chatId)));
  const sourceByChatId = Object.fromEntries(
    sources.map((s) => [normalizeChatId(s.chatId), s])
  );

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
  await client.connect();
  const me = await client.getMe();
  const collectorStartedAt = new Date();
  const chatIds = sources.map((s) => normalizeChatId(s.chatId));
  const lastIndexedDateByChatId = await loadLastIndexedDates(
    prisma,
    chatIds,
    collectorStartedAt
  );

  const pollMs = collectorPollMs();
  const tz = collectorTimezone();
  console.log(
    `采集已启动 (${me.firstName || me.id})，监听 ${sources.length} 个频道…` +
      (isMediaDownloadEnabled() ? " [媒体下载:开]" : " [媒体下载:关]") +
      (pollMs > 0 ? ` [轮询:${pollMs / 1000}s]` : " [轮询:关]") +
      ` [时区:${tz}]`
  );
  for (const s of sources) {
    const cid = normalizeChatId(s.chatId);
    const floor = lastIndexedDateByChatId.get(cid);
    console.log(
      `  - ${s.title || s.username} (${s.chatId}) 仅新于 ${formatCollectorTime(floor)}`
    );
  }

  try {
    await client.getDialogs({ limit: 200 });
  } catch (err) {
    console.warn("[启动] getDialogs 失败（可忽略）:", err.message);
  }

  const albumBuffer = new Map();
  let pollRunning = false;

  async function bumpSourceCursor(source, msgId) {
    if (!source || msgId <= (source.lastMessageId || 0)) return;
    source.lastMessageId = msgId;
    await prisma.tgSourceChannel.update({
      where: { id: source.id },
      data: { lastMessageId: source.lastMessageId, updatedAt: new Date() }
    });
  }

  /** @returns {boolean} 是否应入库（false = 历史消息，仅推进游标） */
  function shouldIngestByTime(chatId, messageDate) {
    const floor = lastIndexedDateByChatId.get(chatId);
    return isNewerThanFloor(messageDate, floor);
  }

  async function flushAlbum(groupKey, via = "消息") {
    const items = albumBuffer.get(groupKey);
    if (!items?.length) return;
    albumBuffer.delete(groupKey);
    const chatId = items[0].chatId;
    const source = sourceByChatId[chatId];
    const payload = await buildAlbumPayload(client, items, chatId, {
      title: source?.title,
      username: source?.username
    });

    if (!shouldIngestByTime(chatId, payload.messageDate)) {
      const maxId = Math.max(...items.map((i) => i.msg.id));
      if (collectorDebug()) {
        console.log(
          `[跳过/历史] ${chatId}/${maxId} 相册 ${formatCollectorTime(payload.messageDate)}`
        );
      }
      if (source) await bumpSourceCursor(source, maxId);
      return;
    }

    await upsertIndexedMessage(prisma, {
      chatId: items[0].chatId,
      ...payload
    });
    const nImg =
      (payload.mediaUrl ? 1 : 0) +
      (payload.galleryImageUrls
        ? (() => {
            try {
              return JSON.parse(payload.galleryImageUrls).length;
            } catch {
              return 0;
            }
          })()
        : 0);
    const mediaHint = nImg > 1 ? ` +${nImg}图` : payload.mediaUrl ? " +媒体" : "";
    console.log(
      `[相册${via === "轮询" ? "/轮询" : ""}] ${items[0].chatId}/${payload.messageId} ${payload.title.slice(0, 40)}${mediaHint}`
    );
    if (source) {
      const maxId = Math.max(...items.map((i) => i.msg.id));
      await bumpSourceCursor(source, maxId);
      bumpLastIndexedDate(lastIndexedDateByChatId, chatId, payload.messageDate);
    }
  }

  async function ingestMessage(msg, chatId, via = "消息") {
    const source = sourceByChatId[chatId];
    if (!source) return;

    const messageDate = messageDateFromMsg(msg);

    if (!shouldIngestByTime(chatId, messageDate)) {
      if (collectorDebug()) {
        console.log(
          `[跳过/历史] ${chatId}/${msg.id} ${formatCollectorTime(messageDate)}`
        );
      }
      await bumpSourceCursor(source, msg.id);
      return;
    }

    const payload = messageToIndexPayload(msg, {
      title: source.title,
      username: source.username
    });

    if (payload.mediaGroupId) {
      const key = `${chatId}:${payload.mediaGroupId}`;
      if (!albumBuffer.has(key)) {
        albumBuffer.set(key, []);
        setTimeout(() => flushAlbum(key, via), 2500);
      }
      albumBuffer.get(key).push({ msg, chatId, payload });
      return;
    }

    await attachMediaFields(client, msg, payload, chatId);
    await upsertIndexedMessage(prisma, { chatId, ...payload });
    const mediaHint = payload.mediaUrl ? " +媒体" : "";
    const tag = via === "轮询" ? "[消息/轮询]" : "[消息]";
    console.log(
      `${tag} ${chatId}/${payload.messageId} ${payload.contentType} ${payload.title.slice(0, 50)}${mediaHint}`
    );

    await bumpSourceCursor(source, msg.id);
    bumpLastIndexedDate(lastIndexedDateByChatId, chatId, payload.messageDate);
  }

  async function pollSource(source) {
    const chatId = normalizeChatId(source.chatId);
    if (!chatId) return;
    const entity = await client.getEntity(source.chatId);
    const minId = source.lastMessageId || 0;
    const messages = await client.getMessages(entity, { minId, limit: 30 });
    if (!messages?.length) return;

    const sorted = [...messages].sort((a, b) => a.id - b.id);
    for (const msg of sorted) {
      if (!msg?.id || msg.id <= minId) continue;
      await ingestMessage(msg, chatId, "轮询");
    }
  }

  async function pollAllSources() {
    if (pollRunning) return;
    pollRunning = true;
    try {
      for (const source of sources) {
        try {
          await pollSource(source);
        } catch (err) {
          const label = source.title || source.username || source.chatId;
          console.warn(`[轮询] ${label}: ${err.message}`);
        }
      }
    } finally {
      pollRunning = false;
    }
  }

  client.addEventHandler(
    async (event) => {
      try {
        const msg = event.message;
        if (!msg || !msg.id) return;

        const chatId = normalizeChatId(peerIdToChatId(event.chatId));
        if (!chatId || !chatIdSet.has(chatId)) return;

        await ingestMessage(msg, chatId, "消息");
      } catch (err) {
        console.error("处理消息失败:", err.message);
      }
    },
    new NewMessage({})
  );

  if (pollMs > 0) {
    setTimeout(() => {
      pollAllSources().catch((err) => console.warn("[轮询] 首次失败:", err.message));
    }, 5000);
    setInterval(() => {
      pollAllSources().catch((err) => console.warn("[轮询] 失败:", err.message));
    }, pollMs);
  }

  process.on("SIGINT", async () => {
    console.log("\n正在退出…");
    await client.disconnect();
    await prisma.$disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

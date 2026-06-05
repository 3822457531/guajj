/**
 * 回补源频道最近 N 条消息到索引库
 * 用法: node collector/backfill.js 200
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");
const { messageToIndexPayload, peerIdToChatId } = require("./parse");
const { normalizeChatId } = require("./chat-id");
const { buildAlbumPayload, attachMediaFields } = require("./album-merge");
const { createPrisma, upsertIndexedMessage } = require("../lib/tg-index-ingest");

async function flushAlbumGroup(client, prisma, groupItems, chatId, source) {
  if (!groupItems.length) return;
  const payload = await buildAlbumPayload(client, groupItems, chatId, {
    title: source.title,
    username: source.username
  });
  await upsertIndexedMessage(prisma, { chatId, ...payload });
}

async function main() {
  const limit = Math.min(500, Math.max(1, Number(process.argv[2]) || 50));
  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) throw new Error("请先 npm run collector:login");

  const prisma = createPrisma();
  const sources = await prisma.tgSourceChannel.findMany({
    where: { isEnabled: true, chatId: { not: null } }
  });
  if (sources.length === 0) throw new Error("请先 collector:sync-channels");

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
  await client.connect();

  for (const source of sources) {
    console.log(`回补 @${source.username || source.chatId} 最近 ${limit} 条…`);
    const entity = await client.getEntity(source.chatId);
    const chatId = normalizeChatId(source.chatId);
    let count = 0;
    let maxMsgId = source.lastMessageId || 0;
    let albumGroup = [];
    let albumKey = null;

    async function flushAlbum() {
      if (!albumGroup.length) return;
      await flushAlbumGroup(client, prisma, albumGroup, chatId, source);
      count++;
      albumGroup = [];
      albumKey = null;
    }

    for await (const msg of client.iterMessages(entity, { limit })) {
      if (!msg.id) continue;
      maxMsgId = Math.max(maxMsgId, msg.id);

      if (msg.groupedId != null) {
        const key = `${chatId}:${msg.groupedId}`;
        if (albumKey && albumKey !== key) await flushAlbum();
        albumKey = key;
        albumGroup.push({ msg });
        continue;
      }

      await flushAlbum();

      const payload = messageToIndexPayload(msg, {
        title: source.title,
        username: source.username
      });
      await attachMediaFields(client, msg, payload, chatId);
      await upsertIndexedMessage(prisma, { chatId, ...payload });
      count++;
    }

    await flushAlbum();
    if (maxMsgId > (source.lastMessageId || 0)) {
      await prisma.tgSourceChannel.update({
        where: { id: source.id },
        data: { lastMessageId: maxMsgId, updatedAt: new Date() }
      });
    }
    console.log(`  写入 ${count} 条，游标 messageId≤${maxMsgId}`);
  }

  await client.disconnect();
  await prisma.$disconnect();
  console.log("回补完成。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

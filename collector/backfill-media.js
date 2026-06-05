/**
 * 为已有索引补下载媒体（mediaUrl 为空且为图/视频；相册按 mediaGroupId 整组重下）
 * 用法: node collector/backfill-media.js 100
 */
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");
const { normalizeChatId } = require("./chat-id");
const { buildAlbumPayload, attachMediaFields } = require("./album-merge");
const { createPrisma } = require("../lib/tg-index-ingest");

async function main() {
  const limit = Math.min(500, Math.max(1, Number(process.argv[2]) || 30));
  const { apiId, apiHash, sessionFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) throw new Error("请先 npm run collector:login");

  const prisma = createPrisma();
  const rows = await prisma.tgIndexedMessage.findMany({
    where: {
      OR: [
        { mediaUrl: null, contentType: { in: ["PHOTO", "VIDEO"] } },
        { mediaGroupId: { not: null }, galleryImageUrls: null, contentType: "PHOTO" }
      ]
    },
    orderBy: { messageDate: "desc" },
    take: limit
  });

  if (rows.length === 0) {
    console.log("没有需要补媒体的记录。");
    await prisma.$disconnect();
    return;
  }

  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
  await client.connect();

  let ok = 0;
  let fail = 0;

  for (const row of rows) {
    const chatId = normalizeChatId(row.chatId);
    try {
      const entity = await client.getEntity(chatId);

      if (row.mediaGroupId) {
        const around = await client.getMessages(entity, {
          minId: Math.max(1, row.messageId - 30),
          maxId: row.messageId + 30
        });
        const group = (around || []).filter(
          (m) => m.groupedId != null && String(m.groupedId) === row.mediaGroupId
        );
        if (group.length > 1) {
          const payload = await buildAlbumPayload(
            client,
            group.map((msg) => ({ msg })),
            chatId,
            { title: row.sourceTitle, username: row.sourceUsername }
          );
          await prisma.tgIndexedMessage.update({
            where: { id: row.id },
            data: {
              mediaUrl: payload.mediaUrl,
              galleryImageUrls: payload.galleryImageUrls,
              galleryVideoUrls: payload.galleryVideoUrls,
              contentBlocks: payload.contentBlocks,
              title: payload.title,
              snippet: payload.snippet,
              rawText: payload.rawText
            }
          });
          console.log(`已补相册 ${chatId}/${row.messageId} (${group.length} 项)`);
          ok++;
          continue;
        }
      }

      const messages = await client.getMessages(entity, { ids: [row.messageId] });
      const msg = messages?.[0];
      if (!msg?.media) {
        console.log(`跳过 ${chatId}/${row.messageId}：无媒体`);
        fail++;
        continue;
      }
      const payload = {
        messageId: row.messageId,
        contentType: row.contentType,
        title: row.title,
        snippet: row.snippet,
        rawText: row.rawText
      };
      await attachMediaFields(client, msg, payload, chatId);
      if (!payload.mediaUrl) {
        console.log(`失败 ${chatId}/${row.messageId}`);
        fail++;
        continue;
      }
      await prisma.tgIndexedMessage.update({
        where: { id: row.id },
        data: {
          mediaUrl: payload.mediaUrl,
          galleryImageUrls: payload.galleryImageUrls,
          galleryVideoUrls: payload.galleryVideoUrls,
          contentBlocks: payload.contentBlocks
        }
      });
      console.log(`已补媒体 ${chatId}/${row.messageId} → ${payload.mediaUrl}`);
      ok++;
    } catch (err) {
      console.warn(`失败 ${chatId}/${row.messageId}: ${err.message}`);
      fail++;
    }
  }

  await client.disconnect();
  await prisma.$disconnect();
  console.log(`补媒体完成：成功 ${ok}，失败/跳过 ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

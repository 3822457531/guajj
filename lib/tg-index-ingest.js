/**
 * 将解析后的消息写入 TgIndexedMessage（供 collector 使用，CommonJS）
 */
const { PrismaClient } = require("./generated/prisma");

/**
 * @param {import('./generated/prisma').PrismaClient} prisma
 * @param {{
 *   chatId: string;
 *   messageId: number;
 *   messageDate: Date;
 *   contentType: string;
 *   title: string;
 *   snippet: string;
 *   rawText: string;
 *   sourceTitle?: string | null;
 *   sourceUsername?: string | null;
 *   durationSec?: number | null;
 *   mediaUrl?: string | null;
 *   galleryImageUrls?: string | null;
 *   galleryVideoUrls?: string | null;
 *   contentBlocks?: string | null;
 *   mediaGroupId?: string | null;
 * }} data
 */
async function upsertIndexedMessage(prisma, data) {
  return prisma.tgIndexedMessage.upsert({
    where: {
      chatId_messageId: {
        chatId: data.chatId,
        messageId: data.messageId
      }
    },
    create: {
      chatId: data.chatId,
      messageId: data.messageId,
      messageDate: data.messageDate,
      contentType: data.contentType,
      title: data.title.slice(0, 500),
      snippet: data.snippet.slice(0, 2000),
      rawText: data.rawText,
      sourceTitle: data.sourceTitle ?? null,
      sourceUsername: data.sourceUsername ?? null,
      durationSec: data.durationSec ?? null,
      mediaUrl: data.mediaUrl ?? null,
      galleryImageUrls: data.galleryImageUrls ?? null,
      galleryVideoUrls: data.galleryVideoUrls ?? null,
      contentBlocks: data.contentBlocks ?? null,
      mediaGroupId: data.mediaGroupId ?? null
    },
    update: {
      messageDate: data.messageDate,
      contentType: data.contentType,
      title: data.title.slice(0, 500),
      snippet: data.snippet.slice(0, 2000),
      rawText: data.rawText,
      sourceTitle: data.sourceTitle ?? null,
      sourceUsername: data.sourceUsername ?? null,
      durationSec: data.durationSec ?? null,
      ...(data.mediaUrl ? { mediaUrl: data.mediaUrl } : {}),
      ...(data.galleryImageUrls != null ? { galleryImageUrls: data.galleryImageUrls } : {}),
      ...(data.galleryVideoUrls != null ? { galleryVideoUrls: data.galleryVideoUrls } : {}),
      ...(data.contentBlocks != null ? { contentBlocks: data.contentBlocks } : {}),
      mediaGroupId: data.mediaGroupId ?? null
    }
  });
}

function createPrisma() {
  return new PrismaClient();
}

module.exports = { upsertIndexedMessage, createPrisma };

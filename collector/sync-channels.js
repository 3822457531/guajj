/**
 * 解析 channels.json / 数据库中的 @username，写入 TgSourceChannel.chatId
 * 用法: npm run collector:sync-channels
 */
const fs = require("fs");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { requireEnv, readSession } = require("./config");
const { createPrisma } = require("../lib/tg-index-ingest");
const { entityToChatId } = require("./chat-id");

async function loadChannelRows(prisma, channelsFile) {
  const rows = [];
  if (fs.existsSync(channelsFile)) {
    const json = JSON.parse(fs.readFileSync(channelsFile, "utf8"));
    const list = Array.isArray(json) ? json : json.channels || [];
    for (const item of list) {
      rows.push({
        username: (item.username || "").replace(/^@/, ""),
        title: item.title || null,
        inviteLink: item.inviteLink || null,
        isEnabled: item.isEnabled !== false
      });
    }
  }
  const dbRows = await prisma.tgSourceChannel.findMany();
  for (const row of dbRows) {
    if (row.username && !rows.some((r) => r.username === row.username)) {
      rows.push({
        username: row.username.replace(/^@/, ""),
        title: row.title,
        inviteLink: row.inviteLink,
        isEnabled: row.isEnabled
      });
    }
  }
  return rows;
}

async function main() {
  const { apiId, apiHash, sessionFile, channelsFile } = requireEnv();
  const session = readSession(sessionFile);
  if (!session) {
    throw new Error("未找到 session，请先运行: npm run collector:login");
  }

  const prisma = createPrisma();
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5
  });
  await client.connect();

  const rows = await loadChannelRows(prisma, channelsFile);
  if (rows.length === 0) {
    console.log("没有可同步的频道，请编辑 collector/channels.json");
    await client.disconnect();
    await prisma.$disconnect();
    return;
  }

  for (const row of rows) {
    if (!row.username) continue;
    try {
      const entity = await client.getEntity(row.username);
      const chatId = entityToChatId(entity);
      if (!chatId) throw new Error("无法解析 chatId");
      const title = row.title || entity.title || entity.username || row.username;
      const existing = await prisma.tgSourceChannel.findFirst({
        where: { OR: [{ chatId }, { username: row.username }] }
      });
      if (existing) {
        await prisma.tgSourceChannel.update({
          where: { id: existing.id },
          data: {
            chatId,
            username: row.username,
            title,
            inviteLink: row.inviteLink,
            isEnabled: row.isEnabled
          }
        });
        console.log(`更新: @${row.username} → ${chatId} (${title})`);
      } else {
        await prisma.tgSourceChannel.create({
          data: {
            chatId,
            username: row.username,
            title,
            inviteLink: row.inviteLink,
            isEnabled: row.isEnabled
          }
        });
        console.log(`新增: @${row.username} → ${chatId} (${title})`);
      }
    } catch (err) {
      console.error(`失败 @${row.username}: ${err.message}`);
      console.error("  → 请确认采集号已加入该频道");
    }
  }

  await client.disconnect();
  await prisma.$disconnect();
  console.log("频道同步完成。");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

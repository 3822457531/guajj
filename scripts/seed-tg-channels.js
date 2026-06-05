/**
 * 将 collector/channels.json 写入 TgSourceChannel（不解析 chatId，需再 sync）
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("../lib/generated/prisma");

async function main() {
  const file = path.join(__dirname, "..", "collector", "channels.json");
  const list = JSON.parse(fs.readFileSync(file, "utf8"));
  const prisma = new PrismaClient();

  for (const item of list) {
    const username = (item.username || "").replace(/^@/, "");
    if (!username) continue;
    const existing = await prisma.tgSourceChannel.findFirst({ where: { username } });
    if (existing) {
      await prisma.tgSourceChannel.update({
        where: { id: existing.id },
        data: {
          title: item.title ?? existing.title,
          inviteLink: item.inviteLink ?? existing.inviteLink,
          isEnabled: item.isEnabled !== false
        }
      });
    } else {
      await prisma.tgSourceChannel.create({
        data: {
          username,
          title: item.title ?? null,
          inviteLink: item.inviteLink ?? null,
          isEnabled: item.isEnabled !== false
        }
      });
    }
    console.log(`频道配置: @${username}`);
  }

  await prisma.$disconnect();
  console.log("完成。请执行 npm run collector:sync-channels 解析 chatId。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

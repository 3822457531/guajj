const { PrismaClient } = require("../lib/generated/prisma");
const prisma = new PrismaClient();

async function main() {
  const tables = [
    ["AdminUser", () => prisma.adminUser.count()],
    ["Category", () => prisma.category.count()],
    ["Post", () => prisma.post.count()],
    ["Comment", () => prisma.comment.count()],
    ["MediaAsset", () => prisma.mediaAsset.count()],
    ["SocialUser", () => prisma.socialUser.count()],
    ["OAuthLoginState", () => prisma.oAuthLoginState.count()],
    ["TelegramConfig", () => prisma.telegramConfig.count()],
    ["TelegramImport", () => prisma.telegramImport.count()],
    ["TgIndexedMessage", () => prisma.tgIndexedMessage.count()]
  ];
  for (const [name, fn] of tables) {
    try {
      const n = await fn();
      console.log(`${name}: ${n} rows`);
    } catch (e) {
      console.log(`${name}: ERROR ${e.message}`);
    }
  }
  await prisma.$disconnect();
}

main();

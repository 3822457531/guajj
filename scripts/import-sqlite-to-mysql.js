/**
 * 一次性：将 prisma/dev.db（SQLite）中的数据导入当前 DATABASE_URL 指向的 MySQL。
 * 用法：node scripts/import-sqlite-to-mysql.js
 * 需安装 devDependency sql.js；MySQL 表结构须已 migrate deploy。
 */
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");
const { PrismaClient } = require("../lib/generated/prisma");

const sqlitePath = path.join(__dirname, "..", "prisma", "dev.db");

function sqliteTableExists(db, table) {
  const stmt = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1`
  );
  stmt.bind([table]);
  const exists = stmt.step();
  stmt.free();
  return exists;
}

function readSqliteTable(db, table) {
  if (!sqliteTableExists(db, table)) {
    console.log(`[跳过] SQLite 无表 ${table}（旧库正常，可忽略）`);
    return [];
  }
  const stmt = db.prepare(`SELECT * FROM "${table}"`);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function bool(v) {
  return v === 1 || v === true;
}

async function main() {
  if (!(process.env.DATABASE_URL ?? "").startsWith("mysql")) {
    console.error("DATABASE_URL 须为 mysql://...");
    process.exit(1);
  }
  if (!fs.existsSync(sqlitePath)) {
    console.error(`未找到 SQLite 文件: ${sqlitePath}`);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(sqlitePath));
  const prisma = new PrismaClient();

  const imported = [];

  const categories = readSqliteTable(db, "Category");
  for (const row of categories) {
    await prisma.category.upsert({
      where: { id: row.id },
      update: { name: row.name, slug: row.slug },
      create: { id: row.id, name: row.name, slug: row.slug, createdAt: new Date(row.createdAt) }
    });
  }
  if (categories.length) imported.push(`Category(${categories.length})`);

  const tags = readSqliteTable(db, "Tag");
  for (const row of tags) {
    await prisma.tag.upsert({
      where: { id: row.id },
      update: { name: row.name, slug: row.slug },
      create: { id: row.id, name: row.name, slug: row.slug, createdAt: new Date(row.createdAt) }
    });
  }
  if (tags.length) imported.push(`Tag(${tags.length})`);

  const adminUsers = readSqliteTable(db, "AdminUser");
  for (const row of adminUsers) {
    await prisma.adminUser.upsert({
      where: { id: row.id },
      update: { username: row.username, passwordHash: row.passwordHash },
      create: {
        id: row.id,
        username: row.username,
        passwordHash: row.passwordHash,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }
    });
  }
  if (adminUsers.length) imported.push(`AdminUser(${adminUsers.length})`);

  const siteRows = readSqliteTable(db, "SiteSettings");
  for (const row of siteRows) {
    await prisma.siteSettings.upsert({
      where: { id: row.id },
      update: {
        allowAnonymousComments: bool(row.allowAnonymousComments),
        mediaStorage: row.mediaStorage ?? "local",
        r2AccountId: row.r2AccountId ?? null,
        r2BucketName: row.r2BucketName ?? null,
        r2PublicBaseUrl: row.r2PublicBaseUrl ?? null,
        r2AccessKeyId: row.r2AccessKeyId ?? null,
        r2SecretAccessKey: row.r2SecretAccessKey ?? null
      },
      create: {
        id: row.id,
        allowAnonymousComments: bool(row.allowAnonymousComments),
        mediaStorage: row.mediaStorage ?? "local",
        r2AccountId: row.r2AccountId ?? null,
        r2BucketName: row.r2BucketName ?? null,
        r2PublicBaseUrl: row.r2PublicBaseUrl ?? null,
        r2AccessKeyId: row.r2AccessKeyId ?? null,
        r2SecretAccessKey: row.r2SecretAccessKey ?? null,
        updatedAt: new Date(row.updatedAt)
      }
    });
  }
  if (siteRows.length) imported.push(`SiteSettings(${siteRows.length})`);

  const posts = readSqliteTable(db, "Post");
  for (const row of posts) {
    await prisma.post.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        title: row.title,
        summary: row.summary,
        body: row.body,
        type: row.type,
        status: row.status,
        coverUrl: row.coverUrl,
        videoUrl: row.videoUrl ?? null,
        galleryImageUrls: row.galleryImageUrls ?? null,
        galleryVideoUrls: row.galleryVideoUrls ?? null,
        contentBlocks: row.contentBlocks ?? null,
        isPinned: bool(row.isPinned),
        heat: row.heat,
        views: row.views,
        publishedAt: row.publishedAt ? new Date(row.publishedAt) : null,
        categoryId: row.categoryId,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }
    });
  }
  if (posts.length) imported.push(`Post(${posts.length})`);

  const postTags = readSqliteTable(db, "PostTag");
  for (const row of postTags) {
    await prisma.postTag.upsert({
      where: { postId_tagId: { postId: row.postId, tagId: row.tagId } },
      update: {},
      create: { postId: row.postId, tagId: row.tagId }
    });
  }
  if (postTags.length) imported.push(`PostTag(${postTags.length})`);

  const socialUsers = readSqliteTable(db, "SocialUser");
  for (const row of socialUsers) {
    await prisma.socialUser.upsert({
      where: { loginType_socialUid: { loginType: row.loginType, socialUid: row.socialUid } },
      update: {},
      create: {
        id: row.id,
        socialUid: row.socialUid,
        loginType: row.loginType,
        nickname: row.nickname,
        faceimg: row.faceimg,
        gender: row.gender ?? null,
        location: row.location ?? null,
        lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt)
      }
    });
  }
  if (socialUsers.length) imported.push(`SocialUser(${socialUsers.length})`);

  const comments = readSqliteTable(db, "Comment");
  for (const row of comments) {
    await prisma.comment.upsert({
      where: { id: row.id },
      update: {},
      create: {
        id: row.id,
        postId: row.postId,
        authorId: row.authorId,
        parentId: row.parentId ?? null,
        body: row.body,
        createdAt: new Date(row.createdAt)
      }
    });
  }
  if (comments.length) imported.push(`Comment(${comments.length})`);

  const tgIndexed = readSqliteTable(db, "TgIndexedMessage");
  for (const row of tgIndexed) {
    await prisma.tgIndexedMessage.upsert({
      where: { chatId_messageId: { chatId: row.chatId, messageId: row.messageId } },
      update: {},
      create: {
        id: row.id,
        chatId: row.chatId,
        messageId: row.messageId,
        messageDate: new Date(row.messageDate),
        contentType: row.contentType,
        title: row.title,
        snippet: row.snippet,
        rawText: row.rawText,
        sourceTitle: row.sourceTitle ?? null,
        sourceUsername: row.sourceUsername ?? null,
        durationSec: row.durationSec ?? null,
        mediaUrl: row.mediaUrl ?? null,
        mediaGroupId: row.mediaGroupId ?? null,
        createdAt: new Date(row.createdAt)
      }
    });
  }
  if (tgIndexed.length) imported.push(`TgIndexedMessage(${tgIndexed.length})`);

  const optionalTables = [
    "TgSourceChannel",
    "TelegramConfig",
    "TelegramImport",
    "MediaAsset",
    "OAuthLoginState"
  ];
  console.log(imported.length ? `已导入: ${imported.join(", ")}` : "未从 SQLite 读到可导入的数据");
  console.log(
    `以下表若 SQLite 中不存在将自动跳过；存在但未实现导入逻辑的请后台重配: ${optionalTables.join(", ")}`
  );

  await prisma.$disconnect();
  console.log("SQLite → MySQL 导入完成。");
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});

/**
 * @deprecated SQLite 增量脚本已废弃。请使用 Prisma 迁移：
 *   npx prisma migrate deploy
 * 从旧 SQLite 导数据：
 *   node scripts/import-sqlite-to-mysql.js
 */
console.error(
  "migrate-db.js 仅适用于旧版 SQLite，项目已改用 MySQL 8。\n" +
    "  建表: npx prisma migrate deploy\n" +
    "  导数据: node scripts/import-sqlite-to-mysql.js"
);
process.exit(1);

/**
 * 初始化 MySQL 表结构并写入种子数据（替代原 SQLite init-db.js）。
 * 需已配置 .env 中的 DATABASE_URL（mysql://...）。
 */
const { execSync } = require("child_process");

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

async function main() {
  run("npx prisma generate");
  run("npx prisma migrate deploy");
  run("node prisma/seed.js");
  console.log("MySQL setup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * 将 prisma/main.sql（SQLite Navicat 备份）转为 MySQL 8 可导入的 prisma/main.mysql.sql
 * 用法: node scripts/build-main-mysql.js
 */
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const root = path.join(__dirname, "..");
const sqliteDump = path.join(root, "prisma", "main.sql");
const schemaSql = path.join(root, "prisma", "migrations", "20260520120000_init_mysql", "migration.sql");
const outFile = path.join(root, "prisma", "main.mysql.sql");

/** 按外键依赖顺序插入 */
const TABLE_ORDER = [
  "AdminUser",
  "Category",
  "Tag",
  "SiteSettings",
  "SocialUser",
  "Post",
  "PostTag",
  "Comment",
  "MediaAsset",
  "OAuthLoginState",
  "TelegramConfig",
  "TelegramImport",
  "TgIndexedMessage"
];

/** SQLite 数字 chatId 等保留为字符串 */
const STRINGIFY_INT_COLUMNS = {
  TgIndexedMessage: new Set(["chatId"]),
  TelegramImport: new Set(["chatId"]),
  TelegramConfig: new Set(["channelId"])
};

function mysqlEscapeString(s) {
  return `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\r?\n/g, "\\n")}'`;
}

function formatDateTime(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") {
    const d = new Date(val);
    if (Number.isNaN(d.getTime())) return "NULL";
    const pad = (n, w = 2) => String(n).padStart(w, "0");
    return `'${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}'`;
  }
  if (typeof val === "string") {
    if (/^\d{10,}$/.test(val)) return formatDateTime(Number(val));
    if (val.includes("T") || val.includes("-")) {
      const normalized = val.replace("T", " ").replace("Z", "").slice(0, 23);
      return `'${normalized}'`;
    }
  }
  return null;
}

const DATE_COLUMNS = new Set([
  "createdAt",
  "updatedAt",
  "publishedAt",
  "lastLoginAt",
  "expiresAt",
  "messageDate"
]);

function isDateColumn(_table, col) {
  return DATE_COLUMNS.has(col);
}

function toSqlValue(table, col, val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") {
    if (STRINGIFY_INT_COLUMNS[table]?.has(col)) return mysqlEscapeString(String(val));
    const asDate = isDateColumn(table, col) ? formatDateTime(val) : null;
    if (asDate) return asDate;
    return String(val);
  }
  if (typeof val === "string") {
    const asDate = isDateColumn(table, col) ? formatDateTime(val) : null;
    if (asDate) return asDate;
    return mysqlEscapeString(val);
  }
  return mysqlEscapeString(String(val));
}

function readTable(db, table) {
  const cols = [];
  const info = db.exec(`PRAGMA table_info("${table}")`);
  if (!info[0]) return { columns: [], rows: [] };
  for (const row of info[0].values) cols.push(row[1]);

  const data = db.exec(`SELECT * FROM "${table}"`);
  if (!data[0]) return { columns: cols, rows: [] };
  return { columns: cols, rows: data[0].values };
}

async function main() {
  if (!fs.existsSync(sqliteDump)) {
    console.error(`Missing ${sqliteDump}`);
    process.exit(1);
  }
  if (!fs.existsSync(schemaSql)) {
    console.error(`Missing ${schemaSql}`);
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const sqlText = fs.readFileSync(sqliteDump, "utf8");
  const db = new SQL.Database();
  db.run(sqlText);

  const ddl = fs.readFileSync(schemaSql, "utf8");
  const lines = [
    "-- MySQL 8 完整库：由 prisma/main.sql（SQLite）自动转换",
    "-- 导入: npm run db:import-main",
    "SET NAMES utf8mb4;",
    "SET FOREIGN_KEY_CHECKS = 0;",
    "",
    ddl.trim(),
    "",
    "-- ----------------------------",
    "-- Data from SQLite backup",
    "-- ----------------------------",
    ""
  ];

  let totalRows = 0;
  for (const table of TABLE_ORDER) {
    const { columns, rows } = readTable(db, table);
    if (!rows.length) continue;
    lines.push(`-- ${table} (${rows.length} rows)`);
    const colList = columns.map((c) => `\`${c}\``).join(", ");
    for (const row of rows) {
      const vals = columns.map((col, i) => toSqlValue(table, col, row[i]));
      lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES (${vals.join(", ")});`);
      totalRows++;
    }
    lines.push("");
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("");

  fs.writeFileSync(outFile, lines.join("\n"), "utf8");
  console.log(`Wrote ${outFile}`);
  console.log(`Tables: ${TABLE_ORDER.length}, INSERT rows: ${totalRows}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

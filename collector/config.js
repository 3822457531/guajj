const fs = require("fs");
const path = require("path");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function requireEnv() {
  loadEnvFile();
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  if (!apiId || !apiHash) {
    throw new Error("请在 .env 配置 TG_API_ID 与 TG_API_HASH（来自 my.telegram.org/apps）");
  }
  return {
    apiId,
    apiHash,
    phone: process.env.TG_PHONE || "",
    sessionFile: path.resolve(process.env.TG_SESSION_FILE || path.join(__dirname, "session.txt")),
    channelsFile: path.resolve(process.env.TG_CHANNELS_FILE || path.join(__dirname, "channels.json"))
  };
}

function readSession(sessionFile) {
  if (!fs.existsSync(sessionFile)) return "";
  return fs.readFileSync(sessionFile, "utf8").trim();
}

function writeSession(sessionFile, sessionString) {
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
  fs.writeFileSync(sessionFile, sessionString, "utf8");
  console.log(`Session 已保存: ${sessionFile}`);
}

module.exports = { requireEnv, readSession, writeSession, loadEnvFile };

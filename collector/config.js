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

function resolveSessionPaths() {
  loadEnvFile();
  const searchSessionFile = path.resolve(process.env.TG_SESSION_FILE || path.join(__dirname, "session.txt"));
  const mediaSessionFile = path.resolve(
    process.env.TG_MEDIA_SESSION_FILE || path.join(__dirname, "back.txt")
  );
  const streamSessionFile = path.resolve(
    process.env.TG_STREAM_SESSION_FILE || mediaSessionFile
  );
  return { searchSessionFile, mediaSessionFile, streamSessionFile };
}

/** 搜索（极搜 Bot）与播放（频道媒体）是否使用不同 session 文件 */
function sessionsAreSplit() {
  const { searchSessionFile, mediaSessionFile } = resolveSessionPaths();
  if (searchSessionFile === mediaSessionFile) return false;
  return Boolean(readSession(mediaSessionFile));
}

function requireEnv() {
  loadEnvFile();
  const creds = requireGramCredentials("search");
  const { searchSessionFile, mediaSessionFile, streamSessionFile } = resolveSessionPaths();
  return {
    apiId: creds.apiId,
    apiHash: creds.apiHash,
    phone: creds.phone,
    /** 极搜 / 频道列表等搜索链路 */
    sessionFile: searchSessionFile,
    /** 缩略图、视频 warm、batch 等 */
    mediaSessionFile,
    /** 视频直出流（默认与 media 相同；可配第三 session 支持多人并发播放） */
    streamSessionFile,
    channelsFile: path.resolve(process.env.TG_CHANNELS_FILE || path.join(__dirname, "channels.json"))
  };
}

/**
 * GramJS 连接凭证：session 与登录时使用的 api_id/api_hash 绑定，双 App 需分开配置。
 * @param {'search' | 'media' | 'stream'} role
 */
function requireGramCredentials(role) {
  loadEnvFile();
  const searchApiId = Number(process.env.TG_API_ID);
  const searchApiHash = String(process.env.TG_API_HASH || "").trim();
  if (!searchApiId || !searchApiHash) {
    throw new Error("请在 .env 配置 TG_API_ID 与 TG_API_HASH（来自 my.telegram.org/apps）");
  }

  if (role === "search") {
    return {
      apiId: searchApiId,
      apiHash: searchApiHash,
      phone: process.env.TG_PHONE || ""
    };
  }

  const pickDedicated = (apiIdEnv, apiHashEnv, phoneEnv, fallbackPhone) => {
    const apiId = Number(apiIdEnv);
    const apiHash = String(apiHashEnv || "").trim();
    if (Number.isFinite(apiId) && apiId > 0 && apiHash) {
      return {
        apiId,
        apiHash,
        phone: process.env[phoneEnv] || fallbackPhone || ""
      };
    }
    return null;
  };

  if (role === "stream") {
    const dedicated =
      pickDedicated(
        process.env.TG_STREAM_API_ID,
        process.env.TG_STREAM_API_HASH,
        "TG_STREAM_PHONE",
        process.env.TG_MEDIA_PHONE || process.env.TG_PHONE
      ) ||
      pickDedicated(
        process.env.TG_MEDIA_API_ID,
        process.env.TG_MEDIA_API_HASH,
        "TG_MEDIA_PHONE",
        process.env.TG_PHONE
      );
    if (dedicated) return dedicated;
    return {
      apiId: searchApiId,
      apiHash: searchApiHash,
      phone: process.env.TG_MEDIA_PHONE || process.env.TG_PHONE || ""
    };
  }

  const mediaDedicated = pickDedicated(
    process.env.TG_MEDIA_API_ID,
    process.env.TG_MEDIA_API_HASH,
    "TG_MEDIA_PHONE",
    process.env.TG_PHONE
  );
  if (mediaDedicated) return mediaDedicated;

  return {
    apiId: searchApiId,
    apiHash: searchApiHash,
    phone: process.env.TG_MEDIA_PHONE || process.env.TG_PHONE || ""
  };
}

/** 播放号是否配置了独立的 App 凭证（api_id/api_hash） */
function mediaApiIsSplit() {
  loadEnvFile();
  const mediaApiId = Number(process.env.TG_MEDIA_API_ID);
  const mediaApiHash = String(process.env.TG_MEDIA_API_HASH || "").trim();
  return Number.isFinite(mediaApiId) && mediaApiId > 0 && Boolean(mediaApiHash);
}

/** 视频直出流是否使用独立于 back.txt 的第三 session（多人并发播放） */
function streamSessionIsSplit() {
  const { mediaSessionFile, streamSessionFile } = resolveSessionPaths();
  if (streamSessionFile === mediaSessionFile) return false;
  return Boolean(readSession(streamSessionFile));
}

function maskPhone(phone) {
  const s = String(phone || "").trim();
  if (!s) return "(未配置)";
  if (s.length <= 4) return s;
  return `***${s.slice(-4)}`;
}

function sessionBasename(filePath) {
  return path.basename(String(filePath || ""));
}

/** 启动 / 调试：双 session 与 App 凭证概况 */
function describeSessionProfile() {
  const { searchSessionFile, mediaSessionFile, streamSessionFile } = resolveSessionPaths();
  const searchCreds = requireGramCredentials("search");
  const mediaCreds = requireGramCredentials("media");
  const streamCreds = requireGramCredentials("stream");
  const split = sessionsAreSplit();
  const streamSplit = streamSessionIsSplit();
  return {
    dualSession: split,
    streamSessionSplit: streamSplit,
    independentMediaApp: mediaApiIsSplit(),
    /** 双 session 下搜索与播放可并行（各池独立 mutex） */
    parallelSearchAndPlay: split,
    /** 频道详情走 search，视频流走 media/stream，互不阻塞 */
    channelLoadBypassesStream: split,
    search: {
      role: "search",
      sessionFile: searchSessionFile,
      sessionName: sessionBasename(searchSessionFile),
      apiId: searchCreds.apiId,
      phone: maskPhone(searchCreds.phone),
      ready: Boolean(readSession(searchSessionFile))
    },
    media: {
      role: "media",
      sessionFile: mediaSessionFile,
      sessionName: sessionBasename(mediaSessionFile),
      apiId: mediaCreds.apiId,
      phone: maskPhone(mediaCreds.phone),
      ready: Boolean(readSession(mediaSessionFile)),
      fallbackToSearchSession: !split
    },
    stream: {
      role: "stream",
      sessionFile: streamSessionFile,
      sessionName: sessionBasename(streamSessionFile),
      apiId: streamCreds.apiId,
      phone: maskPhone(streamCreds.phone),
      ready: Boolean(readSession(streamSessionFile)),
      sharesMediaSession: !streamSplit
    }
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

module.exports = {
  requireEnv,
  requireGramCredentials,
  readSession,
  writeSession,
  loadEnvFile,
  resolveSessionPaths,
  sessionsAreSplit,
  streamSessionIsSplit,
  mediaApiIsSplit,
  describeSessionProfile,
  sessionBasename,
  maskPhone
};

/**
 * 视频播放路由：R2/CDN vs TG 直出流（大/小文件）
 * 控制台过滤：grep "[tg-search:play]"
 */
const { formatBytes, formatDurationSec } = require("./tg-search-media-metrics");

function videoWarmMaxBytes() {
  const mb = Number(process.env.TG_SEARCH_VIDEO_WARM_MAX_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.round(mb) * 1024 * 1024;
  return 80 * 1024 * 1024;
}

function isVideoWarmEnabled() {
  const max = Number(process.env.TG_SEARCH_CHANNEL_WARM_MAX);
  const warmMax = Number(process.env.TG_SEARCH_VIDEO_WARM_MAX);
  return (Number.isFinite(max) && max > 0) || (Number.isFinite(warmMax) && warmMax > 0);
}

/**
 * @param {{ cached?: boolean, fileSize?: number|null }} input
 */
function classifyVideoPlayRoute(input) {
  if (input.cached) {
    return {
      route: "R2_CDN",
      playMode: "R2/CDN 缓存",
      largeFile: false,
      warmEligible: false
    };
  }
  const size = Number(input.fileSize) || 0;
  const maxBytes = videoWarmMaxBytes();
  const largeFile = size <= 0 || size > maxBytes;
  if (largeFile) {
    return {
      route: "TG_STREAM_LARGE",
      playMode: "大文件 · TG 直出流（不经 R2）",
      largeFile: true,
      warmEligible: false
    };
  }
  return {
    route: "TG_STREAM",
    playMode: "小视频 · TG 直出流（不经 R2）",
    largeFile: false,
    warmEligible: isVideoWarmEnabled()
  };
}

/**
 * @param {Record<string, unknown>} info
 */
function logVideoPlayRoute(info) {
  const username = String(info.username || "");
  const messageId = Math.floor(Number(info.messageId));
  const playMode = String(info.playMode || info.route || "UNKNOWN");
  const parts = [`[tg-search:play] @${username}/#${messageId} → ${playMode}`];

  if (info.cached) parts.push("命中 R2");
  else parts.push("未缓存");

  if (info.fileSize) parts.push(`大小 ${formatBytes(Number(info.fileSize))}`);
  if (info.durationSec) parts.push(`时长 ${formatDurationSec(Number(info.durationSec))}`);

  if (info.range) parts.push(`Range ${info.range}`);

  if (info.largeFile === true) parts.push("策略: 禁止全量 warm");
  else if (info.warmEligible) parts.push("策略: 可后台 warm");
  else parts.push("策略: 仅 stream");

  if (info.ms != null) parts.push(`${info.ms}ms`);

  console.log(parts.join(" | "));
}

/**
 * @param {string|null|undefined} rangeHeader
 * @param {number} fileSize
 */
function parseHttpRange(rangeHeader, fileSize) {
  if (!rangeHeader || !fileSize || fileSize <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/i.exec(String(rangeHeader).trim());
  if (!m) return null;

  let start = m[1] !== "" ? parseInt(m[1], 10) : 0;
  let end = m[2] !== "" ? parseInt(m[2], 10) : fileSize - 1;
  if (!Number.isFinite(start) || start < 0) start = 0;
  if (!Number.isFinite(end) || end >= fileSize) end = fileSize - 1;
  if (start > end) return null;

  return {
    start,
    end,
    length: end - start + 1,
    header: `bytes ${start}-${end}/${fileSize}`
  };
}

module.exports = {
  videoWarmMaxBytes,
  isVideoWarmEnabled,
  classifyVideoPlayRoute,
  logVideoPlayRoute,
  parseHttpRange
};

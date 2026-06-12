/**
 * TG 搜索媒体传输指标：服务端 CMD 输出大小、时长、分阶段耗时与上传进度条
 * 过滤：grep "[tg-search:metrics]"
 */
const { getDurationSec } = require("./parse");

function envMetricsEnabled() {
  const v = String(process.env.TG_SEARCH_MEDIA_METRICS ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  if (v === "1" || v === "true" || v === "on") return true;
  return process.env.NODE_ENV === "development";
}

/** 仅正式 /api/tg-search 或显式 forceMetrics 时输出指标 */
function mediaMetricsEnabled(forceMetrics) {
  if (forceMetrics === true) return envMetricsEnabled();
  if (forceMetrics === false) return false;
  try {
    const { getTgSearchRequestScope } = require("./tg-search-request-context");
    const scope = getTgSearchRequestScope();
    if (scope === "test") return false;
    if (scope === "prod") return envMetricsEnabled();
  } catch {
    /* ignore */
  }
  return false;
}

function formatBytes(n) {
  const bytes = Number(n) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDurationSec(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r > 0 ? `${m}m${r}s` : `${m}m`;
}

function formatMs(ms) {
  const n = Math.max(0, Math.round(Number(ms) || 0));
  if (n < 1000) return `${n}ms`;
  if (n < 60000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.floor(n / 60000)}m${Math.round((n % 60000) / 1000)}s`;
}

function progressBar(ratio, width = 28) {
  const pct = Math.min(100, Math.max(0, Math.round((Number(ratio) || 0) * 100)));
  const filled = Math.round((pct / 100) * width);
  const bar = `${"=".repeat(Math.max(0, filled - 1))}${filled > 0 ? ">" : ""}${" ".repeat(Math.max(0, width - filled))}`;
  return `[${bar}] ${String(pct).padStart(3, " ")}%`;
}

function extractMediaMeta(msg) {
  const doc = msg?.media?.document;
  const fileSize = doc?.size != null ? Number(doc.size) : null;
  const durationSec = getDurationSec(msg);
  const mime = doc?.mimeType || null;
  let fileName = null;
  if (Array.isArray(doc?.attributes)) {
    for (const attr of doc.attributes) {
      if (attr?.fileName) {
        fileName = attr.fileName;
        break;
      }
    }
  }
  return { fileSize, durationSec, mime, fileName };
}

function logMetrics(scope, message, extra) {
  const suffix = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[tg-search:metrics] ${scope} ${message}${suffix}`);
}

/**
 * 单次媒体传输指标（TG 下载 → R2/本地写入）
 */
class MediaTransferMetrics {
  /**
   * @param {{ username: string, messageId: number, variant: string, contentType: string, source?: string }} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.enabled = mediaMetricsEnabled(ctx.forceMetrics);
    this.startedAt = Date.now();
    this.tgDownloadStartedAt = 0;
    this.tgDownloadMs = 0;
    this.r2UploadStartedAt = 0;
    this.r2UploadMs = 0;
    this.bytesDownloaded = 0;
    this.bytesUploaded = 0;
    this.expectedBytes = ctx.fileSize || null;
    this.durationSec = ctx.durationSec ?? null;
    this.cached = false;
    this.dest = null;
    this.lastProgressPct = -1;
    this.lastProgressAt = 0;
  }

  metaLine() {
    const parts = [
      `@${this.ctx.username}/#${this.ctx.messageId}`,
      this.ctx.variant,
      this.ctx.contentType
    ];
    if (this.expectedBytes) parts.push(formatBytes(this.expectedBytes));
    if (this.durationSec) parts.push(`时长 ${formatDurationSec(this.durationSec)}`);
    if (this.ctx.source) parts.push(`via ${this.ctx.source}`);
    return parts.join(" · ");
  }

  start() {
    if (!this.enabled) return;
    logMetrics("START", this.metaLine());
  }

  markCached(url) {
    if (!this.enabled) return;
    this.cached = true;
    logMetrics("CACHE_HIT", this.metaLine(), {
      url: String(url).slice(0, 100),
      totalMs: Date.now() - this.startedAt
    });
  }

  tgDownloadBegin(expectedBytes) {
    if (!this.enabled) return;
    if (expectedBytes) this.expectedBytes = expectedBytes;
    this.tgDownloadStartedAt = Date.now();
    logMetrics("TG_DL", `${this.metaLine()} · 开始从 Telegram 下载`);
  }

  tgDownloadDone(bytes) {
    if (!this.enabled) return;
    this.bytesDownloaded = Number(bytes) || 0;
    this.tgDownloadMs = this.tgDownloadStartedAt ? Date.now() - this.tgDownloadStartedAt : 0;
    const speed =
      this.tgDownloadMs > 0 ? formatBytes((this.bytesDownloaded / this.tgDownloadMs) * 1000) + "/s" : "?";
    logMetrics("TG_DL", `${this.metaLine()} · 下载完成`, {
      size: formatBytes(this.bytesDownloaded),
      ms: this.tgDownloadMs,
      speed
    });
  }

  tgDownloadProgress(bytesDone, totalBytes) {
    if (!this.enabled) return;
    const total = totalBytes || this.expectedBytes;
    if (!total || total <= 0) return;
    const ratio = bytesDone / total;
    const pct = Math.floor(ratio * 100);
    const now = Date.now();
    if (pct === this.lastProgressPct && now - this.lastProgressAt < 800) return;
    if (pct < 100 && pct % 5 !== 0 && pct - this.lastProgressPct < 5) return;
    this.lastProgressPct = pct;
    this.lastProgressAt = now;
    this.bytesDownloaded = bytesDone;
    console.log(
      `[tg-search:metrics] TG_DL  ${progressBar(ratio)} ${formatBytes(bytesDone)}/${formatBytes(total)} · ${this.metaLine()}`
    );
  }

  r2UploadBegin(bytes) {
    if (!this.enabled) return;
    if (bytes) this.bytesUploaded = 0;
    this.r2UploadStartedAt = Date.now();
    logMetrics("R2_UP", `${this.metaLine()} · 开始上传 R2/本地`, {
      size: bytes ? formatBytes(bytes) : undefined
    });
  }

  r2UploadProgress(bytesDone, totalBytes) {
    if (!this.enabled) return;
    const total = totalBytes || this.expectedBytes || this.bytesDownloaded;
    if (!total || total <= 0) return;
    const ratio = bytesDone / total;
    const pct = Math.floor(ratio * 100);
    const now = Date.now();
    if (pct === this.lastProgressPct && now - this.lastProgressAt < 800) return;
    if (pct < 100 && pct % 5 !== 0 && pct - this.lastProgressPct < 5) return;
    this.lastProgressPct = pct;
    this.lastProgressAt = now;
    this.bytesUploaded = bytesDone;
    console.log(
      `[tg-search:metrics] R2_UP  ${progressBar(ratio)} ${formatBytes(bytesDone)}/${formatBytes(total)} · ${this.metaLine()}`
    );
  }

  r2UploadDone(dest) {
    if (!this.enabled) return;
    this.dest = dest;
    this.r2UploadMs = this.r2UploadStartedAt ? Date.now() - this.r2UploadStartedAt : 0;
    const speed =
      this.r2UploadMs > 0 && this.bytesDownloaded
        ? formatBytes((this.bytesDownloaded / this.r2UploadMs) * 1000) + "/s"
        : "?";
    logMetrics("R2_UP", `${this.metaLine()} · 上传完成`, {
      dest: String(dest).slice(0, 100),
      ms: this.r2UploadMs,
      speed
    });
    this.finish();
  }

  finish(extra) {
    if (!this.enabled) return;
    const totalMs = Date.now() - this.startedAt;
    logMetrics(
      "DONE",
      `${this.metaLine()} · 全流程`,
      {
        cached: this.cached,
        tgDownloadMs: this.tgDownloadMs || undefined,
        r2UploadMs: this.r2UploadMs || undefined,
        totalMs,
        size: this.bytesDownloaded ? formatBytes(this.bytesDownloaded) : undefined,
        duration: this.durationSec ? formatDurationSec(this.durationSec) : undefined,
        dest: this.dest ? String(this.dest).slice(0, 80) : undefined,
        ...extra
      }
    );
  }

  fail(phase, err) {
    if (!this.enabled) return;
    logMetrics("FAIL", `${this.metaLine()} · ${phase}`, {
      error: err?.message || String(err),
      tgDownloadMs: this.tgDownloadMs || undefined,
      r2UploadMs: this.r2UploadMs || undefined,
      totalMs: Date.now() - this.startedAt
    });
  }
}

function logChannelLoadSummary(username, extra) {
  if (!mediaMetricsEnabled()) return;
  logMetrics("CHANNEL", `@${username} 频道加载完成`, extra);
}

module.exports = {
  mediaMetricsEnabled,
  envMetricsEnabled,
  formatBytes,
  formatDurationSec,
  formatMs,
  progressBar,
  extractMediaMeta,
  logMetrics,
  MediaTransferMetrics,
  logChannelLoadSummary
};

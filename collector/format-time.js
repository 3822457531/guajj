/**
 * 采集日志/展示用时间（默认东八区，与 Telegram 客户端一致）
 * 环境变量 TG_COLLECTOR_TZ，默认 Asia/Shanghai
 */

function collectorTimezone() {
  const tz = (process.env.TG_COLLECTOR_TZ || "Asia/Shanghai").trim();
  return tz || "Asia/Shanghai";
}

/** @param {Date | null | undefined} date */
function formatCollectorTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "—";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: collectorTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

module.exports = { collectorTimezone, formatCollectorTime };

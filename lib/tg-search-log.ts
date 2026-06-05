/** TG 搜索联调统一日志前缀，便于 pm2 / journal 过滤 */

export function tgSearchLog(
  scope: "search-api" | "channel-api" | "media-api" | "collector",
  message: string,
  extra?: Record<string, unknown>
) {
  const ts = new Date().toISOString();
  const suffix = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[tg-search:${scope}] ${ts} ${message}${suffix}`);
}

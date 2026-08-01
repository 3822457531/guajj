/** 分享文案标题最大字符数 */
export const SHARE_DISPLAY_TITLE_MAX = 40;

export function truncateShareDisplayTitle(
  title: string,
  max = SHARE_DISPLAY_TITLE_MAX
): string {
  const text = title.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** 短链仅含 u + mid，足以定位资源 */
export function buildResourceSharePath(username: string, messageId: number): string {
  const params = new URLSearchParams({
    u: username,
    mid: String(messageId)
  });
  return `/global-search?${params.toString()}`;
}

export function buildAbsoluteResourceShareUrl(username: string, messageId: number): string {
  const path = buildResourceSharePath(username, messageId);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function parseResourceShareParams(searchParams: {
  u?: string;
  mid?: string;
  t?: string;
  l?: string;
}): { username: string; messageId: number; title?: string; label?: string } | null {
  const username = typeof searchParams.u === "string" ? searchParams.u.trim().replace(/^@/, "") : "";
  const messageId = Number(searchParams.mid);
  if (!username || !Number.isFinite(messageId) || messageId <= 0) return null;
  const title = typeof searchParams.t === "string" ? searchParams.t.trim() : undefined;
  const label = typeof searchParams.l === "string" ? searchParams.l.trim() : undefined;
  return { username, messageId, title, label };
}

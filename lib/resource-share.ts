/** 分享文案标题最大字符数 */
export const SHARE_DISPLAY_TITLE_MAX = 40;

const PUBLIC_ID_RE = /^GUA-\d{6}$/;

export function isShareReferrerId(value: string | null | undefined): value is string {
  return Boolean(value && PUBLIC_ID_RE.test(value.trim()));
}

/** 截断并压成单行，避免分享文案被标题换行拆碎 */
export function truncateShareDisplayTitle(
  title: string,
  max = SHARE_DISPLAY_TITLE_MAX
): string {
  const text = title.trim().replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export type ResourceShareOptions = {
  /** 分享者 GUA 身份 ID，新用户注册后给其加瓜皮 */
  ref?: string | null;
};

/** 短链：u + mid 定位资源；可选 ref 做推广归因 */
export function buildResourceSharePath(
  username: string,
  messageId: number,
  options?: ResourceShareOptions
): string {
  const params = new URLSearchParams({
    u: username,
    mid: String(messageId)
  });
  const ref = options?.ref?.trim();
  if (ref && isShareReferrerId(ref)) {
    params.set("ref", ref);
  }
  return `/global-search?${params.toString()}`;
}

export function buildAbsoluteResourceShareUrl(
  username: string,
  messageId: number,
  options?: ResourceShareOptions
): string {
  const path = buildResourceSharePath(username, messageId, options);
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return path;
}

/** 组装分享复制文案（标题单行 + 带 ref 的短链） */
export function buildResourceShareText(
  username: string,
  messageId: number,
  title?: string | null,
  options?: ResourceShareOptions
): string {
  const url = buildAbsoluteResourceShareUrl(username, messageId, options);
  const displayTitle = truncateShareDisplayTitle(title?.trim() || `@${username}`);
  return `吃瓜网 · ${displayTitle}\n${url}`;
}

export function parseResourceShareParams(searchParams: {
  u?: string;
  mid?: string;
  t?: string;
  l?: string;
  ref?: string;
}): { username: string; messageId: number; title?: string; label?: string; ref?: string } | null {
  const username = typeof searchParams.u === "string" ? searchParams.u.trim().replace(/^@/, "") : "";
  const messageId = Number(searchParams.mid);
  if (!username || !Number.isFinite(messageId) || messageId <= 0) return null;
  const title = typeof searchParams.t === "string" ? searchParams.t.trim() : undefined;
  const label = typeof searchParams.l === "string" ? searchParams.l.trim() : undefined;
  const refRaw = typeof searchParams.ref === "string" ? searchParams.ref.trim() : undefined;
  const ref = refRaw && isShareReferrerId(refRaw) ? refRaw : undefined;
  return { username, messageId, title, label, ref };
}

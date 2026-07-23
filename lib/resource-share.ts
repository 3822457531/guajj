export type ResourceShareMeta = {
  title?: string | null;
  label?: string | null;
};

export function buildResourceSharePath(
  username: string,
  messageId: number,
  meta?: ResourceShareMeta
): string {
  const params = new URLSearchParams({
    u: username,
    mid: String(messageId)
  });
  const title = meta?.title?.trim();
  const label = meta?.label?.trim();
  if (title) params.set("t", title);
  if (label) params.set("l", label);
  return `/global-search?${params.toString()}`;
}

export function buildAbsoluteResourceShareUrl(
  username: string,
  messageId: number,
  meta?: ResourceShareMeta
): string {
  const path = buildResourceSharePath(username, messageId, meta);
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

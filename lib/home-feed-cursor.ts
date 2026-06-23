/** 首页 feed 分页游标：按排序时间 + id 编码 */
export function encodeHomeFeedCursor(date: Date, id: string): string {
  return Buffer.from(`${date.toISOString()}|${id}`).toString("base64url");
}

export function parseHomeFeedCursor(raw: string | null | undefined): { date: Date; id: string } | null {
  if (!raw?.trim()) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.lastIndexOf("|");
    if (sep < 0) return null;
    const date = new Date(decoded.slice(0, sep));
    const id = decoded.slice(sep + 1);
    if (Number.isNaN(date.getTime()) || !id) return null;
    return { date, id };
  } catch {
    return null;
  }
}

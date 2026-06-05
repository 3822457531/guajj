import { TgIndexContentType } from "@/lib/generated/prisma";

export function contentTypeIcon(type: TgIndexContentType): string {
  switch (type) {
    case TgIndexContentType.VIDEO:
      return "🎬";
    case TgIndexContentType.PHOTO:
      return "🖼";
    case TgIndexContentType.DOCUMENT:
      return "📄";
    default:
      return "💬";
  }
}

export function contentTypeLabel(type: TgIndexContentType): string {
  switch (type) {
    case TgIndexContentType.VIDEO:
      return "视频";
    case TgIndexContentType.PHOTO:
      return "图片";
    case TgIndexContentType.DOCUMENT:
      return "文件";
    default:
      return "文本";
  }
}

export function formatDuration(sec?: number | null): string | null {
  if (sec == null || sec < 1) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}]`;
}

export function formatMessageDate(d: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}

export function buildVipListHref(q: string, page?: number, tab?: string): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page && page > 1) params.set("page", String(page));
  if (tab && tab !== "all") params.set("tab", tab);
  const s = params.toString();
  return s ? `/vip?${s}` : "/vip";
}

export function buildVipDetailHref(id: string, q: string, page?: number): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page && page > 1) params.set("page", String(page));
  const s = params.toString();
  return s ? `/vip/${id}?${s}` : `/vip/${id}`;
}

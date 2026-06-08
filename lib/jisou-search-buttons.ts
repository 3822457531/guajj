export type JisouButtonItem = {
  text: string;
  className?: string;
  url?: string | null;
  callback?: string | null;
};

export type JisouSearchButtons = {
  filters: JisouButtonItem[];
  actions: JisouButtonItem[];
};

/** 本站启用的极搜结果筛选类型 */
export const SUPPORTED_JISOU_FILTER_TYPES = new Set(["channel", "Video", "Photo", "Audio", "GText"]);

const FILTER_TYPE_ICONS: Record<string, string> = {
  channel: "📢",
  Video: "🎬",
  Photo: "🖼️",
  Audio: "🎧",
  GText: "💬"
};

/** TG 原始行首图标 → 网页展示用（提升辨识度） */
const JISOU_TG_TO_DISPLAY_ICON: Record<string, string> = {
  "🏞": "🖼️"
};

const FILTER_TYPE_LABELS: Record<string, string> = {
  channel: "频道",
  Video: "视频",
  Photo: "图片",
  Audio: "音频",
  GText: "文字"
};

/** 将 TG 图标转为网页更易识别的展示图标 */
export function jisouDisplayResultIcon(icon: string | null | undefined): string | null {
  if (!icon) return null;
  return JISOU_TG_TO_DISPLAY_ICON[icon] ?? icon;
}

/** 筛选按钮展示文案（callback 映射优先，覆盖 TG 的 🏞） */
export function jisouFilterButtonLabel(btn: JisouButtonItem): string {
  const type = parseJisouCallbackFilterType(btn.callback);
  if (type && FILTER_TYPE_ICONS[type]) return FILTER_TYPE_ICONS[type];
  return btn.text;
}

export function jisouFilterButtonTitle(btn: JisouButtonItem): string {
  const type = parseJisouCallbackFilterType(btn.callback);
  if (type && FILTER_TYPE_LABELS[type]) return FILTER_TYPE_LABELS[type];
  return btn.text;
}

/** 从极搜 callback 解析第三段筛选类型，如 `/s 0 0 channel none 0 18 10` */
export function parseJisouCallbackFilterType(callback: string | null | undefined): string | null {
  if (!callback) return null;
  const match = String(callback).trim().match(/^\/s\s+\S+\s+\S+\s+(\S+)/);
  return match?.[1] ?? null;
}

export function isSupportedJisouFilterCallback(callback: string | null | undefined): boolean {
  const type = parseJisouCallbackFilterType(callback);
  return type != null && SUPPORTED_JISOU_FILTER_TYPES.has(type);
}

export function jisouFilterIconForType(type: string | null | undefined): string | null {
  if (!type) return null;
  return FILTER_TYPE_ICONS[type] ?? null;
}

export function jisouFilterIconForCallback(callback: string | null | undefined, fallbackText?: string): string | null {
  const type = parseJisouCallbackFilterType(callback);
  if (type && FILTER_TYPE_ICONS[type]) return FILTER_TYPE_ICONS[type];
  const text = fallbackText?.trim();
  return text && text.length <= 2 ? text : null;
}

export function pickSupportedJisouFilterButtons(filters: JisouButtonItem[]): JisouButtonItem[] {
  return filters.filter((btn) => isSupportedJisouFilterCallback(btn.callback));
}

/** 极搜结果行首可能出现的类型图标（与 collector/jisou-parse.js 保持一致） */
export const JISOU_RESULT_ICONS = ["📄", "🎬", "🏞", "🎧", "💬", "📢"] as const;

export function parseJisouResultLeadingIcon(text: string | null | undefined): {
  icon: string | null;
  rest: string;
} {
  let trimmed = String(text ?? "").trimStart();
  let icon: string | null = null;
  let changed = true;

  while (changed) {
    changed = false;
    for (const candidate of JISOU_RESULT_ICONS) {
      if (trimmed.startsWith(candidate)) {
        icon = candidate;
        trimmed = trimmed.slice(candidate.length).trimStart();
        changed = true;
        break;
      }
    }
  }

  return {
    icon,
    rest: trimmed.replace(/\s+\d+(?:\.\d+)?[kK万]?\s*$/, "").trim()
  };
}

export function stripJisouResultLeadingIcons(text: string | null | undefined): string {
  return parseJisouResultLeadingIcon(text).rest;
}

/** 单条暗网结果：只展示一个 ico，与 TG 原始行一致 */
export function formatJisouChannelRow(
  channel: { contentIcon?: string | null; title?: string; label?: string },
  activeFilterType?: string | null
): { icon: string | null; title: string } {
  const rawTitle = String(channel.title ?? channel.label ?? "").trim();
  const fromTitle = parseJisouResultLeadingIcon(rawTitle);
  const rawIcon =
    fromTitle.icon ||
    channel.contentIcon?.trim() ||
    jisouFilterIconForType(activeFilterType) ||
    null;
  const title = stripJisouResultLeadingIcons(rawTitle);

  return { icon: jisouDisplayResultIcon(rawIcon), title: title || rawTitle };
}

/** @deprecated 请用 formatJisouChannelRow */
export function resolveJisouChannelResultIcon(
  channel: { contentIcon?: string | null; title?: string; label?: string },
  activeFilterType?: string | null
): string | null {
  return formatJisouChannelRow(channel, activeFilterType).icon;
}

export function normalizeJisouSearchButtons(raw: unknown): JisouSearchButtons {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = (key: "filters" | "actions"): JisouButtonItem[] => {
    const list = source[key];
    if (!Array.isArray(list)) return [];
    return list
      .map((item): JisouButtonItem | null => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const text = String(row.text ?? "").trim();
        if (!text) return null;
        return {
          text,
          className: row.className != null ? String(row.className) : undefined,
          url: row.url != null ? String(row.url) : null,
          callback: row.callback != null ? String(row.callback) : null
        };
      })
      .filter((item): item is JisouButtonItem => item != null);
  };

  return {
    filters: pick("filters"),
    actions: pick("actions")
  };
}

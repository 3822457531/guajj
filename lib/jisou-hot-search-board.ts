import type { Prisma } from "@/lib/generated/prisma";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { prisma } from "@/lib/prisma";

export const JISOU_HOT_BOARD_QUERY = "/reso";

export type HotSearchBoardItem = {
  label: string;
  rank: number;
  group: "top" | "more";
  callback?: string | null;
};

type JisouButtonRow = {
  text?: string;
  callback?: string | null;
};

type JisouButtonsPayload = {
  filters?: JisouButtonRow[];
  actions?: JisouButtonRow[];
};

const SKIP_BUTTON = /^(下一页|上一页|最新|过滤|热搜)$/;

function shouldSkipHotLabel(label: string) {
  if (!label || label.length < 2) return true;
  if (SKIP_BUTTON.test(label)) return true;
  if (/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u.test(label)) return true;
  return false;
}

/** 从极搜 /reso 返回的 buttons 提取热搜词条 */
export function extractHotSearchItems(buttons: unknown): HotSearchBoardItem[] {
  const payload = (buttons ?? {}) as JisouButtonsPayload;
  const filters = Array.isArray(payload.filters) ? payload.filters : [];
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const seen = new Set<string>();
  const out: HotSearchBoardItem[] = [];

  for (const btn of filters) {
    const label = String(btn.text ?? "").trim();
    if (shouldSkipHotLabel(label) || seen.has(label)) continue;
    seen.add(label);
    out.push({
      label,
      rank: out.length + 1,
      group: "top",
      callback: btn.callback ?? null
    });
  }

  for (const btn of actions) {
    const label = String(btn.text ?? "").trim();
    if (shouldSkipHotLabel(label) || seen.has(label)) continue;
    seen.add(label);
    out.push({
      label,
      rank: out.length + 1,
      group: "more",
      callback: btn.callback ?? null
    });
  }

  return out;
}

function parseFetchedAt(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getLatestHotSearchBoard() {
  const row = await prisma.jisouHotSearchSnapshot.findFirst({
    orderBy: { createdAt: "desc" }
  });
  if (!row) return null;

  return {
    id: row.id,
    keywordCount: row.keywordCount,
    items: row.items as HotSearchBoardItem[],
    sourceFetchedAt: row.sourceFetchedAt,
    createdAt: row.createdAt
  };
}

/** 宝塔定时任务：拉取极搜 /reso 并写入最新快照 */
export async function syncJisouHotSearchBoardFromCollector() {
  const svc = loadJisouSearchService<JisouSearchService>();
  const result = await svc.searchJisouChannels(JISOU_HOT_BOARD_QUERY, { webCaptcha: false });
  const items = extractHotSearchItems(result.buttons);

  if (items.length === 0) {
    const err = new Error("极搜 /reso 未返回热搜词条");
    (err as Error & { code?: string }).code = "EMPTY_HOT_BOARD";
    throw err;
  }

  const itemsJson = JSON.parse(JSON.stringify(items)) as Prisma.InputJsonValue;
  const row = await prisma.jisouHotSearchSnapshot.create({
    data: {
      keywordCount: items.length,
      items: itemsJson,
      sourceFetchedAt: parseFetchedAt(result.fetchedAt)
    }
  });

  return {
    snapshotId: row.id,
    keywordCount: items.length,
    sourceFetchedAt: row.sourceFetchedAt,
    createdAt: row.createdAt,
    items
  };
}

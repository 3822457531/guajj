import { NextResponse } from "next/server";
import { syncJisouHotSearchBoardFromCollector } from "@/lib/jisou-hot-search-board";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function readCronKey(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("key")?.trim() || request.headers.get("x-cron-key")?.trim() || "";
}

export async function GET(request: Request) {
  const expected = process.env.JISOU_HOT_SEARCH_CRON_KEY?.trim();
  if (!expected) {
    return NextResponse.json({ ok: false, error: "cron_key_not_configured" }, { status: 503 });
  }

  const provided = readCronKey(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const snapshot = await syncJisouHotSearchBoardFromCollector();
    return NextResponse.json({
      ok: true,
      snapshotId: snapshot.snapshotId,
      keywordCount: snapshot.keywordCount,
      sourceFetchedAt: snapshot.sourceFetchedAt?.toISOString() ?? null,
      createdAt: snapshot.createdAt.toISOString()
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || "SYNC_FAILED";
    const message = err instanceof Error ? err.message : "同步热搜榜失败";
    const status =
      code === "JISOU_CAPTCHA_REQUIRED"
        ? 428
        : code === "NO_SESSION" || code === "SESSION_REVOKED"
          ? 503
          : code === "EMPTY_HOT_BOARD"
            ? 502
            : 500;
    return NextResponse.json({ ok: false, error: code, message }, { status });
  }
}

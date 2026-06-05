import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { tgSearchLog } from "@/lib/tg-search-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const started = Date.now();
  tgSearchLog("search-api", "POST /api/test/tg-search/search 收到请求");

  let body: { q?: string };
  try {
    body = await request.json();
  } catch (err) {
    tgSearchLog("search-api", "请求体 JSON 解析失败", {
      error: err instanceof Error ? err.message : String(err)
    });
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const q = String(body.q ?? "").trim();
  if (!q) {
    tgSearchLog("search-api", "缺少关键词 q");
    return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400 });
  }

  tgSearchLog("search-api", "开始极搜", { q });

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.searchJisouChannels(q);
    tgSearchLog("search-api", "极搜成功", {
      q,
      channels: result.channels?.length ?? 0,
      ms: Date.now() - started
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
    const message = (err as Error)?.message || mapped.message;
    tgSearchLog("search-api", "极搜失败", {
      q,
      code,
      message,
      ms: Date.now() - started
    });
    const status =
      code === "NO_SESSION" || code === "SESSION_REVOKED"
        ? 503
        : code === "JISOU_REPLY_TIMEOUT" || code === "FLOOD_WAIT"
          ? 504
          : 500;
    return NextResponse.json(
      {
        ok: false,
        error: code,
        message
      },
      { status }
    );
  }
}

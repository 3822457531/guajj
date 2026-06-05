import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { tgSearchLog } from "@/lib/tg-search-log";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? searchParams.get("u") ?? "").trim();
  const messageId = Number(searchParams.get("messageId") ?? searchParams.get("mid") ?? 0);
  const thumbRaw = searchParams.get("thumb");
  const thumb = thumbRaw === null ? undefined : thumbRaw !== "0";

  if (!username || messageId <= 0) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  tgSearchLog("media-api", "GET /api/test/tg-search/media", { username, messageId, thumb });

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.resolveMessageMedia(username, messageId, { thumb });
    tgSearchLog("media-api", "媒体就绪", {
      username,
      messageId,
      cached: result.cached,
      ms: Date.now() - started
    });

    if (result.url) {
      return NextResponse.redirect(result.url, {
        status: 302,
        headers: {
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
        }
      });
    }

    if (result.buffer) {
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": result.mime,
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    return NextResponse.json({ ok: false, error: "empty_media" }, { status: 500 });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
    tgSearchLog("media-api", "媒体失败", {
      username,
      messageId,
      code,
      message: (err as Error)?.message,
      ms: Date.now() - started
    });
    const status = code === "NO_MEDIA" || code === "INVALID_PARAMS" ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: code, message: (err as Error)?.message || mapped.message },
      { status }
    );
  }
}

import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { tgSearchLog } from "@/lib/tg-search-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? searchParams.get("u") ?? "").trim();
  const search = String(searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const messageId = Number(searchParams.get("messageId") || searchParams.get("mid") || 0);

  tgSearchLog("channel-api", "GET /api/test/tg-search/channel 收到请求", {
    username,
    search: search || null,
    limit,
    messageId: messageId > 0 ? messageId : null
  });

  if (!username) {
    tgSearchLog("channel-api", "缺少 username");
    return NextResponse.json({ ok: false, error: "missing_username" }, { status: 400 });
  }

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.fetchChannelMessages(username, {
      limit,
      search: search || undefined,
      messageId: messageId > 0 ? messageId : undefined
    });
    tgSearchLog("channel-api", "频道消息拉取成功", {
      username,
      count: result.count,
      rawCount: result.rawCount,
      anchorMessageId: result.anchorMessageId,
      ms: Date.now() - started
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
    const message = (err as Error)?.message || mapped.message;
    tgSearchLog("channel-api", "频道消息拉取失败", {
      username,
      code,
      message,
      ms: Date.now() - started
    });
    const status =
      code === "CHANNEL_PRIVATE" || code === "USERNAME_INVALID"
        ? 403
        : code === "NO_SESSION" || code === "SESSION_REVOKED"
          ? 503
          : code === "FLOOD_WAIT"
            ? 429
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

import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JisouSearchService = {
  fetchChannelMessages: (
    username: string,
    opts: { limit?: number; search?: string; messageId?: number }
  ) => Promise<unknown>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? searchParams.get("u") ?? "").trim();
  const search = String(searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const messageId = Number(searchParams.get("messageId") || searchParams.get("mid") || 0);

  if (!username) {
    return NextResponse.json({ ok: false, error: "missing_username" }, { status: 400 });
  }

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.fetchChannelMessages(username, {
      limit,
      search: search || undefined,
      messageId: messageId > 0 ? messageId : undefined
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
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
        message: (err as Error)?.message || mapped.message
      },
      { status }
    );
  }
}

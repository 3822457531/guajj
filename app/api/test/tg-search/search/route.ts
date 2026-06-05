import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type JisouSearchService = {
  searchJisouChannels: (query: string) => Promise<unknown>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

export async function POST(request: Request) {
  let body: { q?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const q = String(body.q ?? "").trim();
  if (!q) {
    return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400 });
  }

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.searchJisouChannels(q);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
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
        message: (err as Error)?.message || mapped.message
      },
      { status }
    );
  }
}

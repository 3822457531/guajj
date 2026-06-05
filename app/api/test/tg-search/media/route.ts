import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type JisouSearchService = {
  downloadMessageMedia: (
    username: string,
    messageId: number,
    opts: { thumb?: boolean | undefined }
  ) => Promise<{ buffer: Buffer; mime: string }>;
  mapGramError: (err: unknown) => { code: string; message: string };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? searchParams.get("u") ?? "").trim();
  const messageId = Number(searchParams.get("messageId") ?? searchParams.get("mid") ?? 0);
  const thumbRaw = searchParams.get("thumb");
  const thumb = thumbRaw === null ? undefined : thumbRaw !== "0";

  if (!username || messageId <= 0) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const { buffer, mime } = await svc.downloadMessageMedia(username, messageId, { thumb });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
    const status = code === "NO_MEDIA" || code === "INVALID_PARAMS" ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: code, message: (err as Error)?.message || mapped.message },
      { status }
    );
  }
}

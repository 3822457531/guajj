import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const { id } = await ctx.params;
  const challengeId = String(id ?? "").trim();
  if (!challengeId) {
    return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });
  }

  const svc = loadJisouSearchService<JisouSearchService>();
  const image = svc.getJisouCaptchaImage(challengeId);
  if (!image?.buffer) {
    return NextResponse.json({ ok: false, error: "captcha_not_found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, no-store"
    }
  });
}

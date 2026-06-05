import { NextResponse } from "next/server";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { tgSearchLog } from "@/lib/tg-search-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CaptchaErr = Error & {
  code?: string;
  captcha?: { challengeId: string; prompt: string; options: string[]; expiresInSec: number };
  query?: string;
};

export async function POST(request: Request) {
  const started = Date.now();
  let body: { challengeId?: string; answer?: string | number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const challengeId = String(body.challengeId ?? "").trim();
  const answer = String(body.answer ?? "").trim();
  if (!challengeId || !answer) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  tgSearchLog("search-api", "POST captcha/solve", { challengeId, answer });

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.solveJisouCaptchaAndSearch(challengeId, answer);
    tgSearchLog("search-api", "验证码通过并完成极搜", {
      challengeId,
      channels: result.channels?.length ?? 0,
      ms: Date.now() - started
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const e = err as CaptchaErr;
    const mapped = svc.mapGramError(err);
    const code = e?.code || mapped.code;
    const message = e?.message || mapped.message;

    if (code === "JISOU_CAPTCHA_REQUIRED" && e.captcha) {
      return NextResponse.json(
        {
          ok: false,
          error: code,
          message,
          query: e.query,
          captcha: {
            ...e.captcha,
            imageUrl: `/api/test/tg-search/captcha/${e.captcha.challengeId}/image`
          }
        },
        { status: 428 }
      );
    }

    const status =
      code === "JISOU_CAPTCHA_EXPIRED" || code === "JISOU_CAPTCHA_INVALID_ANSWER"
        ? 400
        : code === "NO_SESSION" || code === "SESSION_REVOKED"
          ? 503
          : 500;
    return NextResponse.json({ ok: false, error: code, message }, { status });
  }
}

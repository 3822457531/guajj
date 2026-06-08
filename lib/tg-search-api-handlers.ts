import { NextResponse } from "next/server";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import {
  getCachedGlobalSearch,
  touchGlobalSearchCache,
  upsertGlobalSearchCache
} from "@/lib/global-search-cache";
import { loadJisouSearchService } from "@/lib/load-jisou-search-service";
import type { JisouSearchService } from "@/lib/jisou-search-types";
import { tgSearchLog } from "@/lib/tg-search-log";
import { tgSearchCaptchaImageUrl } from "@/lib/tg-search-api-paths";
import { recordSearchLogFromRequest, SearchSource } from "@/lib/search-analytics";
import { assertGlobalSearchAllowed, getGuestGlobalSearchQuota, type SearchQuotaStatus } from "@/lib/search-quota";

export { TG_SEARCH_API } from "@/lib/tg-search-api-paths";
export type { TgSearchApiScope } from "@/lib/tg-search-api-paths";

type CaptchaErr = Error & {
  code?: string;
  captcha?: { challengeId: string; prompt: string; options: string[]; expiresInSec: number };
  query?: string;
};

function captchaJsonPayload(apiBase: string, captcha: NonNullable<CaptchaErr["captcha"]>, extra?: Record<string, unknown>) {
  return {
    ...extra,
    captcha: {
      ...captcha,
      imageUrl: tgSearchCaptchaImageUrl(apiBase, captcha.challengeId)
    }
  };
}

function quotaJson(quota: SearchQuotaStatus) {
  return {
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    searchBonus: quota.searchBonus,
    hasIdentity: quota.hasIdentity,
    publicId: quota.publicId
  };
}

function quotaBlockedResponse(quota: SearchQuotaStatus) {
  return NextResponse.json(
    {
      ok: false,
      error: quota.hasIdentity ? "SEARCH_QUOTA_EXCEEDED" : "GUEST_IDENTITY_REQUIRED",
      message: quota.hasIdentity
        ? `今日全网搜索次数已用完（${quota.used}/${quota.limit}），邀请好友可增加额度`
        : "请先在「我的」获取 GUA 身份后再使用全网搜索",
      quota: quotaJson(quota)
    },
    { status: quota.hasIdentity ? 429 : 401 }
  );
}

async function recordGlobalSearchIfBillable(request: Request, keyword: string, channelCount: number) {
  if (channelCount <= 0) return;
  await recordSearchLogFromRequest(request, SearchSource.GLOBAL, keyword, channelCount);
}

async function readGuestUserIdFromRequest() {
  const session = await getGuestSessionPayload();
  return session?.guestUserId ?? null;
}

async function tryServeCachedGlobalSearch(guestUserId: string, keyword: string, started: number) {
  const cached = await getCachedGlobalSearch(guestUserId, keyword);
  if (!cached) return null;

  await touchGlobalSearchCache(cached.id);
  const quota = await getGuestGlobalSearchQuota(guestUserId);
  tgSearchLog("search-api", "命中本地缓存", {
    q: keyword,
    channels: cached.channelCount,
    ms: Date.now() - started
  });

  return NextResponse.json({
    ok: true,
    ...cached.payload,
    channelCount: cached.channelCount,
    cached: true,
    quota: quotaJson(quota)
  });
}

export async function handleTgSearchPost(request: Request, apiBase: string) {
  const started = Date.now();
  tgSearchLog("search-api", `POST ${apiBase}/search 收到请求`);

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
    return NextResponse.json({ ok: false, error: "missing_query" }, { status: 400 });
  }

  const guestUserId = await readGuestUserIdFromRequest();
  if (guestUserId) {
    const cachedResponse = await tryServeCachedGlobalSearch(guestUserId, q, started);
    if (cachedResponse) return cachedResponse;
  }

  const quotaCheck = await assertGlobalSearchAllowed();
  if (!quotaCheck.allowed) {
    return quotaBlockedResponse(quotaCheck.quota);
  }

  tgSearchLog("search-api", "开始极搜", { q });
  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.searchJisouChannels(q, { webCaptcha: true });
    const channelCount = result.channels?.length ?? 0;
    if (channelCount > 0) {
      await recordGlobalSearchIfBillable(request, q, channelCount);
      if (guestUserId) {
        await upsertGlobalSearchCache(guestUserId, q, result);
      }
    }
    tgSearchLog("search-api", "极搜成功", {
      q,
      channels: channelCount,
      ms: Date.now() - started
    });
    const freshQuota = await assertGlobalSearchAllowed();
    return NextResponse.json({
      ok: true,
      ...result,
      channelCount,
      cached: false,
      quota: quotaJson(freshQuota.quota)
    });
  } catch (err: unknown) {
    const e = err as CaptchaErr;
    const mapped = svc.mapGramError(err);
    const code = e?.code || mapped.code;
    const message = e?.message || mapped.message;

    if (code === "JISOU_CAPTCHA_REQUIRED" && e.captcha) {
      tgSearchLog("search-api", "极搜需网页验证码", {
        q,
        challengeId: e.captcha.challengeId,
        ms: Date.now() - started
      });
      return NextResponse.json(
        captchaJsonPayload(apiBase, e.captcha, {
          ok: false,
          error: code,
          message,
          query: e.query || q
        }),
        { status: 428 }
      );
    }

    tgSearchLog("search-api", "极搜失败", { q, code, message, ms: Date.now() - started });
    const status =
      code === "NO_SESSION" || code === "SESSION_REVOKED"
        ? 503
        : code === "JISOU_REPLY_TIMEOUT" || code === "FLOOD_WAIT"
          ? 504
          : 500;
    return NextResponse.json({ ok: false, error: code, message }, { status });
  }
}

export async function handleTgCaptchaSolvePost(request: Request, apiBase: string) {
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

  const quotaCheck = await assertGlobalSearchAllowed();
  if (!quotaCheck.allowed) {
    return quotaBlockedResponse(quotaCheck.quota);
  }

  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.solveJisouCaptchaAndSearch(challengeId, answer);
    const channelCount = result.channels?.length ?? 0;
    const q = String(result.query || "").trim();
    const guestUserId = await readGuestUserIdFromRequest();
    if (channelCount > 0 && q) {
      await recordGlobalSearchIfBillable(request, q, channelCount);
      if (guestUserId) {
        await upsertGlobalSearchCache(guestUserId, q, result);
      }
    }
    tgSearchLog("search-api", "验证码通过并完成极搜", {
      challengeId,
      channels: channelCount,
      ms: Date.now() - started
    });
    const freshQuota = await assertGlobalSearchAllowed();
    return NextResponse.json({
      ok: true,
      ...result,
      channelCount,
      cached: false,
      quota: quotaJson(freshQuota.quota)
    });
  } catch (err: unknown) {
    const e = err as CaptchaErr;
    const mapped = svc.mapGramError(err);
    const code = e?.code || mapped.code;
    const message = e?.message || mapped.message;

    if (code === "JISOU_CAPTCHA_REQUIRED" && e.captcha) {
      return NextResponse.json(
        captchaJsonPayload(apiBase, e.captcha, {
          ok: false,
          error: code,
          message,
          query: e.query
        }),
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

export async function handleTgSearchActionPost(request: Request, apiBase: string) {
  const started = Date.now();
  tgSearchLog("search-api", `POST ${apiBase}/action 收到请求`);

  const guestUserId = await readGuestUserIdFromRequest();
  if (!guestUserId) {
    const quota = await getGuestGlobalSearchQuota(null);
    return NextResponse.json(
      {
        ok: false,
        error: "GUEST_IDENTITY_REQUIRED",
        message: "请先在「我的」获取 GUA 身份后再使用全网搜索",
        quota: quotaJson(quota)
      },
      { status: 401 }
    );
  }

  let body: { replyMessageId?: number; callback?: string; text?: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const replyMessageId = Number(body.replyMessageId) || 0;
  const callback = String(body.callback ?? "").trim();
  const text = String(body.text ?? "").trim();
  const query = String(body.query ?? "").trim();

  if (replyMessageId <= 0 || (!callback && !text)) {
    return NextResponse.json({ ok: false, error: "missing_params", message: "缺少操作参数" }, { status: 400 });
  }

  tgSearchLog("search-api", "极搜按钮操作", { replyMessageId, callback: callback || null, text: text || null, query });
  const svc = loadJisouSearchService<JisouSearchService>();

  try {
    const result = await svc.clickJisouSearchButton({
      replyMessageId,
      callback: callback || undefined,
      text: text || undefined,
      query,
      webCaptcha: true
    });
    const channelCount = result.channels?.length ?? 0;
    const quota = await getGuestGlobalSearchQuota(guestUserId);
    tgSearchLog("search-api", "极搜按钮操作成功", {
      replyMessageId,
      channels: channelCount,
      ms: Date.now() - started
    });
    return NextResponse.json({
      ok: true,
      ...result,
      channelCount,
      cached: false,
      quota: quotaJson(quota)
    });
  } catch (err: unknown) {
    const e = err as CaptchaErr;
    const mapped = svc.mapGramError(err);
    const code = e?.code || mapped.code;
    const message = e?.message || mapped.message;

    if (code === "JISOU_CAPTCHA_REQUIRED" && e.captcha) {
      tgSearchLog("search-api", "极搜操作需网页验证码", {
        replyMessageId,
        challengeId: e.captcha.challengeId,
        ms: Date.now() - started
      });
      return NextResponse.json(
        captchaJsonPayload(apiBase, e.captcha, {
          ok: false,
          error: code,
          message,
          query: e.query || query
        }),
        { status: 428 }
      );
    }

    tgSearchLog("search-api", "极搜按钮操作失败", { replyMessageId, code, message, ms: Date.now() - started });
    const status =
      code === "JISOU_MESSAGE_NOT_FOUND" || code === "JISOU_BUTTON_NOT_FOUND"
        ? 404
        : code === "NO_SESSION" || code === "SESSION_REVOKED"
          ? 503
          : code === "JISOU_SEARCH_UPDATE_TIMEOUT" || code === "FLOOD_WAIT"
            ? 504
            : 500;
    return NextResponse.json({ ok: false, error: code, message }, { status });
  }
}

export async function handleTgChannelGet(request: Request) {
  const started = Date.now();
  const { searchParams } = new URL(request.url);
  const username = String(searchParams.get("username") ?? searchParams.get("u") ?? "").trim();
  const search = String(searchParams.get("search") ?? searchParams.get("q") ?? "").trim();
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
  const messageId = Number(searchParams.get("messageId") || searchParams.get("mid") || 0);

  tgSearchLog("channel-api", "GET channel 收到请求", {
    username,
    search: search || null,
    limit,
    messageId: messageId > 0 ? messageId : null
  });

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
    tgSearchLog("channel-api", "频道消息拉取成功", {
      username,
      count: result.count,
      ms: Date.now() - started
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    const mapped = svc.mapGramError(err);
    const code = (err as { code?: string })?.code || mapped.code;
    const message = (err as Error)?.message || mapped.message;
    const status =
      code === "CHANNEL_PRIVATE" || code === "USERNAME_INVALID"
        ? 403
        : code === "NO_SESSION" || code === "SESSION_REVOKED"
          ? 503
          : code === "FLOOD_WAIT"
            ? 429
            : 500;
    return NextResponse.json({ ok: false, error: code, message }, { status });
  }
}

export async function handleTgMediaGet(request: Request) {
  const started = Date.now();
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
    const status = code === "NO_MEDIA" || code === "INVALID_PARAMS" ? 404 : 500;
    return NextResponse.json(
      { ok: false, error: code, message: (err as Error)?.message || mapped.message },
      { status }
    );
  }
}

export async function handleTgCaptchaImageGet(challengeId: string) {
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

import { NextResponse } from "next/server";
import { searchIndexedMessages, VIP_SEARCH_PAGE_SIZE } from "@/lib/tg-index-search";
import { assertSearchAllowed } from "@/lib/search-quota";
import { recordSearchLog } from "@/lib/search-analytics";
import { SearchSource } from "@/lib/generated/prisma";
import { cookies, headers } from "next/headers";
import { getClientIpFromHeaders } from "@/lib/client-ip";
import { readGuestUserIdFromCookieHeader } from "@/lib/guest-auth";
import { readSocialUserIdFromCookieHeader } from "@/lib/analytics";

export const dynamic = "force-dynamic";

function parsePage(raw: string | null) {
  const n = Math.floor(Number(raw) || 1);
  return n > 0 ? n : 1;
}

/** GET /api/vip/search?q=关键词&page=1 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = parsePage(searchParams.get("page"));
  const pageSizeRaw = Math.floor(Number(searchParams.get("pageSize")) || VIP_SEARCH_PAGE_SIZE);
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  if (!q) {
    return NextResponse.json({ ok: true, q: "", items: [], total: 0, page: 1, pageSize, totalPages: 0 });
  }

  if (page === 1) {
    const check = await assertSearchAllowed();
    if (!check.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "daily_limit",
          quota: {
            used: check.quota.used,
            limit: check.quota.limit,
            remaining: check.quota.remaining,
            hasIdentity: check.quota.hasIdentity
          }
        },
        { status: 429 }
      );
    }
  }

  const result = await searchIndexedMessages(q, page, pageSize);

  if (page === 1) {
    const [cookieStore, hdrs] = await Promise.all([cookies(), headers()]);
    const cookieHeader = hdrs.get("cookie") ?? "";
    await recordSearchLog({
      source: SearchSource.VIP,
      keyword: q,
      visitorId: cookieStore.get("cg_vid")?.value?.trim() || "unknown",
      ip: getClientIpFromHeaders(hdrs),
      socialUserId: readSocialUserIdFromCookieHeader(cookieHeader),
      guestUserId: readGuestUserIdFromCookieHeader(cookieHeader),
      resultCount: result.total,
      userAgent: hdrs.get("user-agent")
    });
  }

  return NextResponse.json({
    ok: true,
    q,
    items: result.items.map((item) => ({
      id: item.id,
      title: item.title,
      snippet: item.snippet,
      contentType: item.contentType,
      sourceTitle: item.sourceTitle,
      sourceUsername: item.sourceUsername,
      durationSec: item.durationSec,
      messageDate: item.messageDate.toISOString(),
      detailUrl: `/vip/${item.id}?q=${encodeURIComponent(q)}&page=${result.page}`
    })),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages
  });
}

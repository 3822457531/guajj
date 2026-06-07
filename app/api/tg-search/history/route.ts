import { NextResponse } from "next/server";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import {
  getGuestGlobalSearchHistoryKeywords,
  hideGuestGlobalSearchHistory,
  normalizeSearchKeyword
} from "@/lib/search-analytics";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: true, keywords: [] });
  }

  const keywords = await getGuestGlobalSearchHistoryKeywords(session.guestUserId, 30);
  return NextResponse.json({
    ok: true,
    keywords: keywords.map((row) => ({
      keyword: row.keyword,
      searchedAt: row.searchedAt?.toISOString() ?? null
    }))
  });
}

export async function DELETE(request: Request) {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { all?: boolean; keyword?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (body.all) {
    await hideGuestGlobalSearchHistory(session.guestUserId, { all: true });
    return NextResponse.json({ ok: true });
  }

  const keyword = normalizeSearchKeyword(String(body.keyword ?? ""));
  if (!keyword) {
    return NextResponse.json({ ok: false, error: "missing_keyword" }, { status: 400 });
  }

  await hideGuestGlobalSearchHistory(session.guestUserId, { keyword });
  return NextResponse.json({ ok: true });
}

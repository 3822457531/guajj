import { NextResponse } from "next/server";
import { getHomeFeedLatestPage, homeFeedPageToJson, HOME_FEED_PAGE_SIZE } from "@/lib/home-feed";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const channelIds = searchParams.getAll("channel").filter(Boolean);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? String(HOME_FEED_PAGE_SIZE), 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : HOME_FEED_PAGE_SIZE;

  const page = await getHomeFeedLatestPage({ cursor, channelIds, limit });
  return NextResponse.json(homeFeedPageToJson(page));
}

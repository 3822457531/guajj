import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/client-ip";
import {
  analyticsInternalSecret,
  readSocialUserIdFromCookieHeader,
  recordPageVisit,
  shouldTrackPageVisit
} from "@/lib/analytics";

export const runtime = "nodejs";

type CollectBody = {
  path?: string;
  visitorId?: string;
  ip?: string;
  cookie?: string;
  userAgent?: string;
  referrer?: string;
};

export async function POST(request: Request) {
  const secret = request.headers.get("x-analytics-secret");
  if (!secret || secret !== analyticsInternalSecret()) {
    return new NextResponse(null, { status: 403 });
  }

  let body: CollectBody;
  try {
    body = (await request.json()) as CollectBody;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const path = body.path?.trim();
  const visitorId = body.visitorId?.trim();
  if (!path || !visitorId) {
    return new NextResponse(null, { status: 400 });
  }

  if (!shouldTrackPageVisit(path)) {
    return new NextResponse(null, { status: 204 });
  }

  const socialUserId = readSocialUserIdFromCookieHeader(body.cookie ?? request.headers.get("cookie"));

  await recordPageVisit({
    path,
    visitorId,
    ip: body.ip?.trim() || getClientIp(request),
    socialUserId,
    userAgent: body.userAgent,
    referrer: body.referrer
  });

  return new NextResponse(null, { status: 204 });
}

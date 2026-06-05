import { isAdminAreaRequest, isLegacyAdminRequest, mapToInternalAdminPath } from "@/lib/admin-path";
import { isDocumentNavigation, shouldTrackPageVisit } from "@/lib/analytics-edge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const VISITOR_COOKIE = "cg_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 30;

function newVisitorId() {
  return crypto.randomUUID();
}

function collectUrl(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}/api/analytics/collect`;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (isLegacyAdminRequest(pathname)) {
    return new NextResponse(null, { status: 404 });
  }

  const internalAdmin = mapToInternalAdminPath(pathname);
  if (internalAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = internalAdmin;
    return NextResponse.rewrite(url);
  }

  if (
    request.method !== "GET" ||
    isAdminAreaRequest(pathname) ||
    !shouldTrackPageVisit(pathname) ||
    !isDocumentNavigation(request.headers)
  ) {
    return NextResponse.next();
  }

  let visitorId = request.cookies.get(VISITOR_COOKIE)?.value;
  const needsCookie = !visitorId;
  if (!visitorId) visitorId = newVisitorId();

  const secret = process.env.ANALYTICS_INTERNAL_SECRET || process.env.AUTH_SECRET || "change-this-local-secret-before-production";

  const payload = JSON.stringify({
    path: pathname,
    visitorId,
    ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown",
    cookie: request.headers.get("cookie") || "",
    userAgent: request.headers.get("user-agent") || "",
    referrer: request.headers.get("referer") || ""
  });

  void fetch(collectUrl(request), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-analytics-secret": secret
    },
    body: payload
  }).catch(() => {});

  const response = NextResponse.next();
  if (needsCookie) {
    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: VISITOR_MAX_AGE,
      path: "/"
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|uploads|favicon.ico|\\.well-known).*)"]
};

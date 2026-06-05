import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  GUEST_COOKIE,
  REF_COOKIE,
  createGuestSessionToken,
  guestSessionCookieOptions,
  getGuestSessionPayload,
  refCookieOptions
} from "@/lib/guest-auth";
import { createGuestUser, findGuestById, touchGuestLogin } from "@/lib/guest-user";
import { getClientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const existing = await getGuestSessionPayload();
  if (existing?.guestUserId) {
    const user = await findGuestById(existing.guestUserId);
    if (user) {
      await touchGuestLogin(user.id, ip);
      return NextResponse.json({
        ok: true,
        alreadyRegistered: true,
        publicId: user.publicId,
        referrerPublicId: user.referrer?.publicId ?? null
      });
    }
  }

  const cookieStore = await cookies();
  const refFromCookie = cookieStore.get(REF_COOKIE)?.value?.trim() || null;

  let refFromBody: string | null = null;
  try {
    const body = await request.json();
    if (body && typeof body.ref === "string") {
      refFromBody = body.ref.trim() || null;
    }
  } catch {
    /* empty body is fine */
  }

  const referrerPublicId = refFromBody || refFromCookie;
  const created = await createGuestUser(referrerPublicId, ip);
  const token = createGuestSessionToken(created.id);

  const response = NextResponse.json({
    ok: true,
    alreadyRegistered: false,
    publicId: created.publicId,
    secretKey: created.secretKey,
    referrerPublicId: created.referrerPublicId
  });

  response.cookies.set(GUEST_COOKIE, token, guestSessionCookieOptions());
  response.cookies.set(REF_COOKIE, "", { ...refCookieOptions(), maxAge: 0 });

  return response;
}

import { NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  createGuestSessionToken,
  getGuestSessionPayload,
  guestSessionCookieOptions
} from "@/lib/guest-auth";
import { countGuestReferrals, findGuestById, touchGuestLogin, verifyGuestSecret } from "@/lib/guest-user";
import { getGuestGlobalSearchQuota } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";
import { getClientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: true, user: null });
  }

  const user = await findGuestById(session.guestUserId);
  if (!user) {
    return NextResponse.json({ ok: true, user: null });
  }

  await touchGuestLogin(user.id, ip);

  const settings = await getSiteSettings();
  const [quota, referralCount] = await Promise.all([
    getGuestGlobalSearchQuota(user.id),
    countGuestReferrals(user.id)
  ]);

  return NextResponse.json({
    ok: true,
    user: {
      publicId: user.publicId,
      referrerPublicId: user.referrer?.publicId ?? null,
      searchBonus: user.searchBonus,
      referralCount,
      usedToday: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      dailyBaseLimit: settings.globalDailySearchLimit ?? 5,
      createdAt: user.createdAt.toISOString()
    }
  });
}

export async function POST(request: Request) {
  let publicId = "";
  let secretKey = "";
  try {
    const body = await request.json();
    publicId = typeof body.publicId === "string" ? body.publicId.trim() : "";
    secretKey = typeof body.secretKey === "string" ? body.secretKey.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  if (!publicId || !secretKey) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  const user = await verifyGuestSecret(publicId, secretKey);
  if (!user) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const ip = getClientIp(request);
  await touchGuestLogin(user.id, ip);

  const token = createGuestSessionToken(user.id);
  const response = NextResponse.json({ ok: true, publicId: user.publicId });
  response.cookies.set(GUEST_COOKIE, token, guestSessionCookieOptions());
  return response;
}

import { NextResponse } from "next/server";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { checkInGuestGuapi } from "@/lib/sms-guapi";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getGuestSessionPayload();
  if (!session?.guestUserId) {
    return NextResponse.json({ ok: false, error: "GUEST_IDENTITY_REQUIRED", message: "请先获取身份" }, { status: 401 });
  }

  try {
    const [result, settings] = await Promise.all([
      checkInGuestGuapi(session.guestUserId),
      getSiteSettings()
    ]);
    return NextResponse.json({
      ok: true,
      granted: result.granted,
      alreadyCheckedIn: result.alreadyCheckedIn,
      checkInGift: settings.checkInGuapiGift ?? 1,
      quota: {
        used: result.quota.used,
        limit: result.quota.limit,
        remaining: result.quota.remaining,
        searchBonus: result.quota.searchBonus,
        hasIdentity: result.quota.hasIdentity,
        publicId: result.quota.publicId,
        checkedInToday: result.quota.checkedInToday
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "签到失败";
    return NextResponse.json({ ok: false, error: "check_in_failed", message }, { status: 500 });
  }
}

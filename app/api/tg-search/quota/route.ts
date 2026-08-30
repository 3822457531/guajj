import { NextResponse } from "next/server";
import { getCurrentGuestGlobalSearchQuota } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const [quota, settings] = await Promise.all([getCurrentGuestGlobalSearchQuota(), getSiteSettings()]);
  return NextResponse.json({
    ok: true,
    quota: {
      used: quota.used,
      limit: quota.limit,
      remaining: quota.remaining,
      searchBonus: quota.searchBonus,
      hasIdentity: quota.hasIdentity,
      publicId: quota.publicId,
      checkedInToday: Boolean(quota.checkedInToday),
      registerGuapiGift: settings.registerGuapiGift ?? settings.globalDailySearchLimit ?? 5,
      checkInGuapiGift: settings.checkInGuapiGift ?? 1,
      /** @deprecated 兼容旧前端字段，等同 registerGuapiGift */
      dailyBaseLimit: settings.registerGuapiGift ?? settings.globalDailySearchLimit ?? 5
    }
  });
}

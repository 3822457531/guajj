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
      dailyBaseLimit: settings.globalDailySearchLimit ?? 5
    }
  });
}

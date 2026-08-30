import type { Metadata } from "next";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { MyPageClient } from "@/components/my-page-client";
import { MyPageEmptyPrompt } from "@/components/my-page-empty-prompt";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { countGuestReferrals, findGuestById } from "@/lib/guest-user";
import { getGuestGlobalSearchQuota } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "我的吃瓜 · 吃瓜网",
  description: "瓜皮额度、推广赚钱与吃瓜足迹"
};

export const dynamic = "force-dynamic";

function MyPageHeader() {
  return (
    <header className="h5-top my-page-top">
      <div className="h5-top-row">
        <div className="h5-brand-block">
          <div className="h5-brand-line">
            <span className="h5-brand-flame" aria-hidden>
              🍉
            </span>
            <span className="h5-brand-title">我的吃瓜</span>
          </div>
          <p className="h5-brand-sub">瓜皮额度 · 推广赚钱 · 足迹</p>
        </div>
      </div>
    </header>
  );
}

export default async function MyPage() {
  const session = await getGuestSessionPayload();
  const settings = await getSiteSettings();

  if (!session?.guestUserId) {
    return (
      <main className="site-shell h5-home my-page">
        <MyPageHeader />
        <div className="h5-container my-page-container">
          <MyPageEmptyPrompt variant="missing" />
        </div>
        <H5SiteBottomNav active="my" variant="dark" />
      </main>
    );
  }

  const user = await findGuestById(session.guestUserId);
  if (!user) {
    return (
      <main className="site-shell h5-home my-page">
        <MyPageHeader />
        <div className="h5-container my-page-container">
          <MyPageEmptyPrompt variant="invalid" />
        </div>
        <H5SiteBottomNav active="my" variant="dark" />
      </main>
    );
  }

  const [quota, referralCount] = await Promise.all([
    getGuestGlobalSearchQuota(user.id),
    countGuestReferrals(user.id)
  ]);

  return (
    <main className="site-shell h5-home my-page">
      <MyPageHeader />

      <div className="h5-container my-page-container">
        <MyPageClient
          publicId={user.publicId}
          referrerPublicId={user.referrer?.publicId ?? null}
          usedToday={quota.used}
          limit={quota.limit}
          remaining={quota.remaining}
          searchBonus={user.searchBonus}
          referralCount={referralCount}
          registerGuapiGift={settings.registerGuapiGift ?? settings.globalDailySearchLimit ?? 5}
          checkInGuapiGift={settings.checkInGuapiGift ?? 1}
          checkedInToday={Boolean(quota.checkedInToday)}
          referralBonusPerInvite={settings.referralSearchBonus}
        />
      </div>

      <H5SiteBottomNav active="my" variant="dark" />
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { MyPageClient } from "@/components/my-page-client";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { countGuestReferrals, findGuestById } from "@/lib/guest-user";
import { countTodaySearchesForGuest } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "我的 · 吃瓜网",
  description: "匿名身份、推广与搜索额度"
};

export const dynamic = "force-dynamic";

export default async function MyPage() {
  const session = await getGuestSessionPayload();
  const settings = await getSiteSettings();

  if (!session?.guestUserId) {
    return (
      <main className="site-shell h5-home my-page">
        <header className="h5-top">
          <div className="h5-top-row">
            <Link href="/" className="h5-brand-block">
              <div className="h5-brand-line">
                <span className="h5-brand-flame" aria-hidden>
                  👤
                </span>
                <span className="h5-brand-title">我的</span>
              </div>
              <p className="h5-brand-sub">匿名身份 · 推广奖励 · 搜索额度</p>
            </Link>
          </div>
        </header>
        <div className="h5-container">
          <p className="my-no-session">请先完成匿名身份注册，弹窗将自动出现。</p>
        </div>
        <H5SiteBottomNav active="my" />
      </main>
    );
  }

  const user = await findGuestById(session.guestUserId);
  if (!user) {
    return (
      <main className="site-shell h5-home my-page">
        <div className="h5-container">
          <p className="my-no-session">身份无效，请清理缓存后重新注册。</p>
        </div>
        <H5SiteBottomNav active="my" />
      </main>
    );
  }

  const [usedToday, referralCount] = await Promise.all([
    countTodaySearchesForGuest(user.id),
    countGuestReferrals(user.id)
  ]);

  const limit = Math.max(0, settings.dailySearchLimit) + Math.max(0, user.searchBonus);
  const remaining = Math.max(0, limit - usedToday);

  return (
    <main className="site-shell h5-home my-page">
      <header className="h5-top">
        <div className="h5-top-row">
          <Link href="/" className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                👤
              </span>
              <span className="h5-brand-title">我的</span>
            </div>
            <p className="h5-brand-sub">匿名身份 · 推广奖励 · 搜索额度</p>
          </Link>
        </div>
      </header>

      <div className="h5-container">
        <MyPageClient
          publicId={user.publicId}
          referrerPublicId={user.referrer?.publicId ?? null}
          usedToday={usedToday}
          limit={limit}
          remaining={remaining}
          searchBonus={user.searchBonus}
          referralCount={referralCount}
          dailyBaseLimit={settings.dailySearchLimit}
          referralBonusPerInvite={settings.referralSearchBonus}
        />
      </div>

      <H5SiteBottomNav active="my" />
    </main>
  );
}

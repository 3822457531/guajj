import type { Metadata } from "next";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { MyPageClient } from "@/components/my-page-client";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { countGuestReferrals, findGuestById } from "@/lib/guest-user";
import { countTodaySearchesForGuest, SearchSource } from "@/lib/search-quota";
import { getSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "我的 · 吃瓜网",
  description: "匿名身份、瓜皮额度与推广奖励"
};

export const dynamic = "force-dynamic";

function MyPageHeader() {
  return (
    <header className="h5-top my-page-top">
      <div className="h5-top-row">
        <div className="h5-brand-block">
          <div className="h5-brand-line">
            <span className="h5-brand-flame" aria-hidden>
              👤
            </span>
            <span className="h5-brand-title">我的</span>
          </div>
          <p className="h5-brand-sub">匿名身份 · 瓜皮额度 · 扫码推广</p>
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
          <div className="my-empty-card">
            <span className="my-empty-icon" aria-hidden>
              🔐
            </span>
            <p className="my-empty-title">尚未创建身份</p>
            <p className="my-empty-desc">完成年龄确认后将自动生成本地加密身份。</p>
          </div>
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
          <div className="my-empty-card">
            <p className="my-empty-title">身份无效</p>
            <p className="my-empty-desc">请清理缓存后重新注册，或使用密钥恢复。</p>
          </div>
        </div>
        <H5SiteBottomNav active="my" variant="dark" />
      </main>
    );
  }

  const [usedToday, referralCount] = await Promise.all([
    countTodaySearchesForGuest(user.id, SearchSource.GLOBAL),
    countGuestReferrals(user.id)
  ]);

  const limit = Math.max(0, settings.globalDailySearchLimit ?? 5) + Math.max(0, user.searchBonus);
  const remaining = Math.max(0, limit - usedToday);

  return (
    <main className="site-shell h5-home my-page">
      <MyPageHeader />

      <div className="h5-container my-page-container">
        <MyPageClient
          publicId={user.publicId}
          referrerPublicId={user.referrer?.publicId ?? null}
          usedToday={usedToday}
          limit={limit}
          remaining={remaining}
          searchBonus={user.searchBonus}
          referralCount={referralCount}
          dailyBaseLimit={settings.globalDailySearchLimit ?? 5}
          referralBonusPerInvite={settings.referralSearchBonus}
        />
      </div>

      <H5SiteBottomNav active="my" variant="dark" />
    </main>
  );
}

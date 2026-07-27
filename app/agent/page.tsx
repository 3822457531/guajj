import type { Metadata } from "next";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { AgentPageClient } from "@/components/agent-page-client";
import { MyPageEmptyPrompt } from "@/components/my-page-empty-prompt";
import { getGuestSessionPayload } from "@/lib/guest-auth";

export const metadata: Metadata = {
  title: "推广赚钱 · 吃瓜网",
  description: "开通代理，直推间推瓜皮充值提成"
};

export const dynamic = "force-dynamic";

export default async function AgentPage() {
  const session = await getGuestSessionPayload();

  return (
    <main className="site-shell h5-home my-page agent-page">
      <header className="h5-top my-page-top">
        <div className="h5-top-row">
          <div className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                💰
              </span>
              <span className="h5-brand-title">推广赚钱</span>
            </div>
            <p className="h5-brand-sub">代理开通 · 直推间推 · 提现</p>
          </div>
        </div>
      </header>

      <div className="h5-container my-page-container">
        {!session?.guestUserId ? (
          <MyPageEmptyPrompt variant="missing" />
        ) : (
          <AgentPageClient />
        )}
      </div>

      <H5SiteBottomNav active="my" variant="dark" />
    </main>
  );
}

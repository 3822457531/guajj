import type { Metadata } from "next";
import Link from "next/link";
import { SmsClient } from "@/components/sms/sms-client";
import { SmsPurposeTip } from "@/components/sms/sms-purpose-modal";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { getGuestSessionPayload } from "@/lib/guest-auth";
import { findGuestById } from "@/lib/guest-user";

export const metadata: Metadata = {
  title: "暗网手机号 · 吃瓜网",
  description: "临时匿名手机号 · 各平台注册登录时接收短信验证码"
};

export const dynamic = "force-dynamic";

export default async function SmsPage() {
  const session = await getGuestSessionPayload();
  const user = session?.guestUserId ? await findGuestById(session.guestUserId) : null;

  return (
    <main className="site-shell h5-home sms-page">
      <header className="h5-top sms-page-top">
        <div className="h5-top-row">
          <div className="h5-brand-block">
            <div className="h5-brand-line h5-brand-line--with-tip">
              <span className="h5-brand-flame" aria-hidden>
                📱
              </span>
              <span className="h5-brand-title">暗网手机号</span>
              <SmsPurposeTip />
            </div>
            <p className="h5-brand-sub">临时匿名号码 · 收短信验证码 · 收码成功后扣瓜皮</p>
          </div>
          <Link href="/my" prefetch={false} className="vip-member-pill">
            <span aria-hidden>👑</span>
            我的身份
          </Link>
        </div>
      </header>

      <div className="h5-container sms-container">
        <SmsClient guestReady={Boolean(user)} />
      </div>

      <H5SiteBottomNav active="sms" variant="dark" />
    </main>
  );
}

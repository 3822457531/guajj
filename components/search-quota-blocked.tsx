import Link from "next/link";

type SearchQuotaBlockedProps = {
  quota: {
    remaining: number;
    limit: number;
    used: number;
    hasIdentity: boolean;
    publicId: string | null;
  };
  variant?: "home" | "vip";
};

export function SearchQuotaBlocked({ quota, variant = "home" }: SearchQuotaBlockedProps) {
  const referralHint = quota.publicId ? `/?ref=${encodeURIComponent(quota.publicId)}` : "/my";

  return (
    <section className={`search-quota-blocked search-quota-blocked--${variant}`}>
      <div className="search-quota-blocked-inner">
        <span className="search-quota-blocked-icon" aria-hidden>
          🔒
        </span>
        {!quota.hasIdentity ? (
          <>
            <h2 className="search-quota-blocked-title">请先获取匿名身份</h2>
            <p className="search-quota-blocked-desc">完成身份注册后即可使用搜索功能。</p>
          </>
        ) : (
          <>
            <h2 className="search-quota-blocked-title">今日搜索次数已用完</h2>
            <p className="search-quota-blocked-desc">
              已使用 {quota.used} / {quota.limit} 次。分享推广链接给好友，每成功邀请一位自动增加搜索次数。
            </p>
            <Link href="/my" className="search-quota-blocked-link">
              前往「我的」复制推广链接 →
            </Link>
            <p className="search-quota-blocked-ref">推广路径示例：{referralHint}</p>
          </>
        )}
      </div>
    </section>
  );
}

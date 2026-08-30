import Link from "next/link";

type SearchQuotaBlockedProps = {
  quota: {
    remaining: number;
    limit: number;
    used: number;
    hasIdentity: boolean;
    publicId: string | null;
    unlimited?: boolean;
  };
  variant?: "home" | "vip" | "global";
};

export function SearchQuotaBlocked({ quota, variant = "home" }: SearchQuotaBlockedProps) {
  const referralHint = quota.publicId ? `/?ref=${encodeURIComponent(quota.publicId)}` : "/my";

  if (variant === "global") {
    return (
      <section className="search-quota-blocked search-quota-blocked--global">
        <div className="search-quota-blocked-inner">
          <span className="search-quota-blocked-icon" aria-hidden>
            🔒
          </span>
          {!quota.hasIdentity ? (
            <>
              <h2 className="search-quota-blocked-title">请先获取匿名身份</h2>
              <p className="search-quota-blocked-desc">完成身份注册后即可使用全网搜索。</p>
              <Link href="/my" className="search-quota-blocked-link">
                前往「我的」获取身份 →
              </Link>
            </>
          ) : (
            <>
              <h2 className="search-quota-blocked-title">瓜皮不足</h2>
              <p className="search-quota-blocked-desc">
                已用 {quota.used} / 累计 {quota.limit}。搜索不消耗瓜皮，观看资源需要瓜皮。可签到、购买，或分享推广链接增加额度。
              </p>
              <Link href="/my" className="search-quota-blocked-link">
                前往「我的」购买瓜皮 →
              </Link>
              <p className="search-quota-blocked-ref">推广路径示例：{referralHint}</p>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className={`search-quota-blocked search-quota-blocked--${variant}`}>
      <div className="search-quota-blocked-inner">
        <span className="search-quota-blocked-icon" aria-hidden>
          🔒
        </span>
        {!quota.hasIdentity ? (
          <>
            <h2 className="search-quota-blocked-title">请先获取匿名身份</h2>
            <p className="search-quota-blocked-desc">完成身份注册后即可使用{variant === "vip" ? "高级" : "全站"}搜索（不限次数）。</p>
            <Link href="/my" className="search-quota-blocked-link">
              前往「我的」获取身份 →
            </Link>
          </>
        ) : (
          <>
            <h2 className="search-quota-blocked-title">搜索功能暂不可用</h2>
            <p className="search-quota-blocked-desc">请刷新页面后重试。</p>
          </>
        )}
      </div>
    </section>
  );
}

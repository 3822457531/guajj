import Link from "next/link";

/** 全站统一底部导航：首页 + 高级搜索 + 我的 */
export function H5SiteBottomNav({
  active,
  variant = "light"
}: {
  active: "home" | "vip" | "my";
  variant?: "light" | "dark";
}) {
  return (
    <nav
      className={`mobile-tabs h5-bottom-tabs h5-site-bottom-nav h5-site-bottom-nav--3${variant === "dark" ? " h5-site-bottom-nav--dark" : ""}`}
      aria-label="站点导航"
    >
      <Link href="/" prefetch={false} className={`h5-bottom-tab${active === "home" ? " is-active" : ""}`}>
        <span className="h5-tab-icon" aria-hidden>
          ⌂
        </span>
        首页
      </Link>
      <Link href="/vip" prefetch={false} className={`h5-bottom-tab${active === "vip" ? " is-active" : ""}`}>
        <span className="h5-tab-icon" aria-hidden>
          🔍
        </span>
        高级搜索
      </Link>
      <Link href="/my" prefetch={false} className={`h5-bottom-tab${active === "my" ? " is-active" : ""}`}>
        <span className="h5-tab-icon" aria-hidden>
          👤
        </span>
        我的
      </Link>
    </nav>
  );
}

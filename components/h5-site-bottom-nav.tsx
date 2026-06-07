import Link from "next/link";
import { TabIconHome, TabIconMy } from "@/components/h5-tab-icons";

/** 全站统一底部导航：首页 + 热搜榜 + 全网搜索 + 我的 */
export function H5SiteBottomNav({
  active,
  variant = "light"
}: {
  active: "home" | "hot" | "global" | "my";
  variant?: "light" | "dark";
}) {
  return (
    <nav
      className={`mobile-tabs h5-bottom-tabs h5-site-bottom-nav h5-site-bottom-nav--4${variant === "dark" ? " h5-site-bottom-nav--dark" : ""}`}
      aria-label="站点导航"
    >
      <Link href="/" prefetch={false} className={`h5-bottom-tab${active === "home" ? " is-active" : ""}`}>
        <span className="h5-tab-icon" aria-hidden>
          <TabIconHome active={active === "home"} />
        </span>
        首页
      </Link>
      <Link href="/vip" prefetch={false} className={`h5-bottom-tab${active === "hot" ? " is-active" : ""}`}>
        <span className="h5-tab-icon h5-tab-icon--emoji" aria-hidden>
          🔥
        </span>
        热搜榜
      </Link>
      <Link
        href="/global-search"
        prefetch={false}
        className={`h5-bottom-tab${active === "global" ? " is-active" : ""}`}
      >
        <span className="h5-tab-icon h5-tab-icon--emoji" aria-hidden>
          🌐
        </span>
        全网搜索
      </Link>
      <Link href="/my" prefetch={false} className={`h5-bottom-tab${active === "my" ? " is-active" : ""}`}>
        <span className="h5-tab-icon" aria-hidden>
          <TabIconMy active={active === "my"} />
        </span>
        我的
      </Link>
    </nav>
  );
}

import Link from "next/link";

/** 热搜 / 全局搜 模式切换 */
export function SearchModeTabs({ active }: { active: "hot" | "global" }) {
  return (
    <nav className="search-mode-tabs" aria-label="搜索模式">
      <Link href="/vip" prefetch={false} className={`search-mode-tab${active === "hot" ? " is-active" : ""}`}>
        热搜
      </Link>
      <Link href="/global-search" prefetch={false} className={`search-mode-tab${active === "global" ? " is-active" : ""}`}>
        全局搜
      </Link>
    </nav>
  );
}

import Link from "next/link";

/** 高级搜索 / 全网搜索 模式切换 */
export function SearchModeTabs({ active }: { active: "vip" | "global" }) {
  return (
    <nav className="search-mode-tabs" aria-label="搜索模式">
      <Link
        href="/vip"
        prefetch={false}
        className={`search-mode-tab${active === "vip" ? " is-active" : ""}`}
      >
        高级搜索
      </Link>
      <Link
        href="/global-search"
        prefetch={false}
        className={`search-mode-tab${active === "global" ? " is-active" : ""}`}
      >
        全网搜索
      </Link>
    </nav>
  );
}

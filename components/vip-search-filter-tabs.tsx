import Link from "next/link";
import { buildVipListHref } from "@/lib/tg-index-display";
import { VIP_SEARCH_TABS, type VipSearchTab } from "@/lib/vip-result-display";

export function VipSearchFilterTabs({ q, activeTab }: { q: string; activeTab: VipSearchTab }) {
  return (
    <nav className="vip-filter-tabs" aria-label="结果筛选">
      {VIP_SEARCH_TABS.map((tab) => (
        <Link
          key={tab.id}
          href={buildVipListHref(q, 1, tab.id)}
          prefetch={false}
          className={`vip-filter-tab${activeTab === tab.id ? " is-active" : ""}`}
          aria-current={activeTab === tab.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

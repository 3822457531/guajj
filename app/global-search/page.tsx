import type { Metadata } from "next";
import Link from "next/link";
import { GlobalSearchClient } from "@/components/global-search/global-search-client";
import { SearchModeTabs } from "@/components/search-mode-tabs";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";

export const metadata: Metadata = {
  title: "全网搜索 · 吃瓜网",
  description: "暗网索引 · 检索全网公开频道与消息预览"
};

export default async function GlobalSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const initialQuery = typeof params.q === "string" ? params.q.trim() : "";

  return (
    <main className="site-shell h5-home global-search-page">
      <header className="h5-top global-search-top">
        <div className="h5-top-row">
          <div className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                🌐
              </span>
              <span className="h5-brand-title">全网搜索</span>
            </div>
            <p className="h5-brand-sub">暗网索引 · 频道与消息预览</p>
          </div>
          <Link href="/my" prefetch={false} className="vip-member-pill">
            <span aria-hidden>👑</span>
            我的身份
          </Link>
        </div>

        <SearchModeTabs active="global" />
      </header>

      <div className="h5-container global-search-container">
        <GlobalSearchClient initialQuery={initialQuery} />
      </div>

      <H5SiteBottomNav active="global" variant="dark" />
    </main>
  );
}

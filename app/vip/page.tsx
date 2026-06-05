import type { Metadata } from "next";
import Link from "next/link";
import { recordSearchLogFromServer, SearchSource } from "@/lib/search-analytics";
import { assertSearchAllowed } from "@/lib/search-quota";
import { VipBottomNav } from "@/components/vip-bottom-nav";
import { SearchQuotaBlocked } from "@/components/search-quota-blocked";
import { VipHotKeywords } from "@/components/vip-hot-keywords";
import { VipLatestFeed } from "@/components/vip-latest-feed";
import { VipSearchFilterTabs } from "@/components/vip-search-filter-tabs";
import { VipSearchResultCard } from "@/components/vip-search-result-card";
import { buildVipDetailHref, buildVipListHref } from "@/lib/tg-index-display";
import {
  getVipHotKeywords,
  listIndexedMessagesForHome,
  searchIndexedMessages
} from "@/lib/tg-index-search";
import { parseVipSearchTab } from "@/lib/vip-result-display";

export const metadata: Metadata = {
  title: "VIP搜索 · 吃瓜网",
  description: "全站索引关键词搜索"
};

export const dynamic = "force-dynamic";

function parsePage(raw: string | undefined) {
  const n = Math.floor(Number(raw) || 1);
  return n > 0 ? n : 1;
}

export default async function VipSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const qRaw = typeof params.q === "string" ? params.q : "";
  const q = qRaw.trim();
  const hasQuery = q.length > 0;
  const page = parsePage(params.page);
  const tab = parseVipSearchTab(params.tab);
  const quotaCheck = hasQuery && page === 1 ? await assertSearchAllowed() : null;
  const searchBlocked = Boolean(hasQuery && page === 1 && quotaCheck && !quotaCheck.allowed);
  const result = hasQuery && !searchBlocked ? await searchIndexedMessages(q, page, undefined, tab) : null;
  if (hasQuery && result && page === 1 && tab === "all" && !searchBlocked) {
    await recordSearchLogFromServer(SearchSource.VIP, q, result.total);
  }
  const [hotKeywords, latestItems] = hasQuery
    ? [[], []]
    : await Promise.all([getVipHotKeywords(), listIndexedMessagesForHome(12)]);

  return (
    <main className={`site-shell h5-home vip-page${hasQuery ? " vip-page--results" : ""}`}>
      <header className="h5-top vip-top">
        {hasQuery ? (
          <>
            <div className="vip-results-head">
              <Link href="/vip" prefetch={false} className="vip-results-back" aria-label="返回">
                ←
              </Link>
              <h1 className="vip-results-title">搜索结果</h1>
              <span className="vip-results-head-spacer" aria-hidden />
            </div>
            <form className="vip-search-bar vip-search-bar--results" method="get" action="/vip">
              {tab !== "all" ? <input type="hidden" name="tab" value={tab} /> : null}
              <div className="vip-search-field">
                <input
                  type="search"
                  name="q"
                  defaultValue={qRaw}
                  placeholder="请输入关键词搜索吃瓜内容..."
                  className="h5-search-input vip-search-input"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </div>
              <button type="submit" className="h5-search-submit vip-search-submit">
                搜索
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="h5-top-row">
              <Link href="/" className="h5-brand-block">
                <div className="h5-brand-line">
                  <span className="h5-brand-flame" aria-hidden>
                    🔍
                  </span>
                  <span className="h5-brand-title">VIP搜索</span>
                </div>
                <p className="h5-brand-sub">全网吃瓜 · 尽在VIP搜索</p>
              </Link>
              <Link href="/my" prefetch={false} className="vip-member-pill">
                <span aria-hidden>👑</span>
                我的身份
              </Link>
            </div>
            <form className="vip-search-bar" method="get" action="/vip">
              <div className="vip-search-field">
                <input
                  type="search"
                  name="q"
                  defaultValue={qRaw}
                  placeholder="请输入关键词搜索吃瓜内容..."
                  className="h5-search-input vip-search-input"
                  autoComplete="off"
                  enterKeyHint="search"
                />
              </div>
              <button type="submit" className="h5-search-submit vip-search-submit">
                搜瓜
              </button>
            </form>
          </>
        )}
      </header>

      <div className="h5-container vip-container">
        {!hasQuery ? (
          <section className="vip-intro">
            <VipHotKeywords keywords={hotKeywords} />
            <VipLatestFeed items={latestItems} />
          </section>
        ) : null}

        {hasQuery && searchBlocked && quotaCheck ? (
          <SearchQuotaBlocked quota={quotaCheck.quota} variant="vip" />
        ) : null}

        {hasQuery && result ? (
          <section className="vip-results" aria-labelledby="vip-results-title">
            <VipSearchFilterTabs q={q} activeTab={tab} />

            <div className="vip-results-toolbar">
              <p id="vip-results-title" className="vip-results-count">
                共找到 <strong>{result.total}</strong> 条相关结果
              </p>
              <span className="vip-results-sort">综合排序</span>
            </div>

            {result.items.length === 0 ? (
              <p className="h5-empty">没有找到相关内容，换个关键词或筛选试试。</p>
            ) : (
              <ul className="vip-result-list">
                {result.items.map((item) => (
                  <VipSearchResultCard
                    key={item.id}
                    item={item}
                    keyword={q}
                    href={buildVipDetailHref(item.id, q, result.page)}
                  />
                ))}
              </ul>
            )}

            {result.totalPages > 1 ? (
              <nav className="vip-pagination" aria-label="分页">
                {result.page > 1 ? (
                  <Link href={buildVipListHref(q, result.page - 1, tab)} prefetch={false} className="vip-page-btn">
                    上一页
                  </Link>
                ) : (
                  <span className="vip-page-btn is-disabled">上一页</span>
                )}
                <span className="vip-page-info">
                  第 {result.page} / {result.totalPages} 页
                </span>
                {result.page < result.totalPages ? (
                  <Link href={buildVipListHref(q, result.page + 1, tab)} prefetch={false} className="vip-page-btn">
                    下一页
                  </Link>
                ) : (
                  <span className="vip-page-btn is-disabled">下一页</span>
                )}
              </nav>
            ) : null}
          </section>
        ) : null}
      </div>

      <VipBottomNav active="vip" />
    </main>
  );
}

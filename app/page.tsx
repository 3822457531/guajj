import Link from "next/link";
import { H5HomeSearchPanel } from "@/components/h5-home-search-panel";
import { H5HomeShell } from "@/components/h5-home-shell";
import { H5HeroCarousel } from "@/components/h5-hero-carousel";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { H5StoryListCard } from "@/components/h5-story-list-card";
import { SearchQuotaBlocked } from "@/components/search-quota-blocked";
import {
  getHomeChannelFilterOptions,
  getHomeFeedItems,
  parseHomeChannelFilter,
  searchHomeFeed
} from "@/lib/home-feed";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { recordSearchLogFromServer, SearchSource } from "@/lib/search-analytics";
import { assertSearchAllowed } from "@/lib/search-quota";

function formatDate(date?: Date | null) {
  if (!date) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function tagToneClass(name: string): string {
  const n = name.length % 3;
  if (n === 0) return "h5-rank-tag--a";
  if (n === 1) return "h5-rank-tag--b";
  return "h5-rank-tag--c";
}

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; q?: string; channel?: string | string[] }>;
}) {
  const params = await searchParams;
  const qRaw = typeof params.q === "string" ? params.q : "";
  const q = qRaw.trim();
  const channelIds = parseHomeChannelFilter(params.channel);
  const hasQuery = q.length > 0;
  const hasChannelFilter = channelIds.length > 0;
  const hasFilter = hasQuery || hasChannelFilter;

  const quotaCheck = hasQuery ? await assertSearchAllowed() : null;
  const searchBlocked = Boolean(hasQuery && quotaCheck && !quotaCheck.allowed);

  const [items, channelOptions] = await Promise.all([
    hasFilter && !searchBlocked ? searchHomeFeed(q, channelIds) : !hasFilter ? getHomeFeedItems() : Promise.resolve([]),
    getHomeChannelFilterOptions()
  ]);

  const selectedChannelLabels = channelOptions.filter((c) => channelIds.includes(c.id)).map((c) => c.label);

  if (hasQuery && !searchBlocked) {
    await recordSearchLogFromServer(SearchSource.HOME, q, items.length);
  }

  const pinnedForCarousel = items.filter((p) => p.isPinned).slice(0, 3);
  const carouselSlides = pinnedForCarousel.map((p) => ({
    id: p.id,
    href: p.href,
    title: p.title,
    summary: p.summary,
    coverUrl: p.coverUrl,
    categoryName: p.categoryName,
    tiles: p.tiles
  }));

  const nonPinned = items.filter((p) => !p.isPinned);
  const latest = nonPinned;

  const filterMetaParts: string[] = [];
  if (hasQuery) filterMetaParts.push(`「${q}」`);
  if (hasChannelFilter) filterMetaParts.push(`类型：${selectedChannelLabels.join("、") || `${channelIds.length} 个`}`);

  return (
    <main className="site-shell h5-home">
      {params.error ? (
        <div className="h5-container h5-flash-wrap">
          <p className="h5-flash-err">登录未完成：{params.error}</p>
        </div>
      ) : null}

      <header className="h5-top">
        <div className="h5-top-row">
          <Link href="/" className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                🔥
              </span>
              <span className="h5-brand-title">吃瓜网</span>
            </div>
            <p className="h5-brand-sub">吃最新鲜的瓜 · 看最劲爆的料</p>
          </Link>
          <H5HomeSearchPanel defaultQuery={qRaw} channels={channelOptions} selectedChannelIds={channelIds} />
        </div>
      </header>

      {hasFilter ? (
        <>
          <div className="h5-container">
            <section className="h5-section h5-search-results" aria-labelledby="search-results-title">
              <div className="h5-search-result-head">
                <h2 id="search-results-title" className="h5-section-title">
                  {hasQuery ? "搜索结果" : "类型筛选"}
                  <span className="h5-search-meta">
                    {filterMetaParts.join(" · ")} · 共 {items.length} 条
                  </span>
                </h2>
                <Link href="/" className="h5-clear-link">
                  清空
                </Link>
              </div>
              {searchBlocked && quotaCheck ? (
                <SearchQuotaBlocked quota={quotaCheck.quota} variant="home" />
              ) : items.length === 0 ? (
                <p className="h5-empty">没有找到相关内容，换个关键词或类型试试。</p>
              ) : (
                <div className="h5-story-grid">
                  {items.map((item) => (
                    <H5StoryListCard
                      key={item.id}
                      postId={item.id}
                      href={item.href}
                      title={item.title}
                      summary={item.summary}
                      categoryName={item.categoryName}
                      timeLabel={formatRelativeTime(item.publishedAt)}
                      tiles={item.tiles}
                      tagToneClass={tagToneClass(item.categoryName)}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <H5SiteBottomNav active="home" />
        </>
      ) : (
        <H5HomeShell
          carousel={carouselSlides.length > 0 ? <H5HeroCarousel items={carouselSlides} /> : null}
          latestPanel={
            <section className="h5-section" id="latest">
              <div className="h5-section-head">
                <h2 className="h5-section-title-row">
                  <span className="h5-section-icon" aria-hidden>
                    📰
                  </span>
                  最新吃瓜
                </h2>
                <span className="h5-chip-sub">图文 · 图集 · 时间线</span>
              </div>
              <div className="h5-story-grid">
                {latest.map((item) => (
                  <H5StoryListCard
                    key={item.id}
                    postId={item.id}
                    href={item.href}
                    title={item.title}
                    summary={item.summary}
                    categoryName={item.categoryName}
                    timeLabel={formatDate(item.publishedAt)}
                    tiles={item.tiles}
                    tagToneClass={tagToneClass(item.categoryName)}
                  />
                ))}
              </div>
            </section>
          }
        />
      )}
    </main>
  );
}

import Link from "next/link";
import { H5HomeLatestFeed } from "@/components/h5-home-latest-feed";
import { H5HomeShell } from "@/components/h5-home-shell";
import { H5HeroCarousel } from "@/components/h5-hero-carousel";
import { getHomeFeedLatestPage, getHomeFeedPinnedItems, homeFeedItemToJson } from "@/lib/home-feed";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const [pinnedItems, latestPage] = await Promise.all([getHomeFeedPinnedItems([], 3), getHomeFeedLatestPage()]);

  const carouselSlides = pinnedItems.map((p) => ({
    id: p.id,
    href: p.href,
    title: p.title,
    summary: p.summary,
    coverUrl: p.coverUrl,
    categoryName: p.categoryName,
    tiles: p.tiles
  }));

  const initialLatest = latestPage.items.map(homeFeedItemToJson);

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
        </div>
      </header>

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
            <H5HomeLatestFeed
              initialItems={initialLatest}
              initialNextCursor={latestPage.nextCursor}
              initialHasMore={latestPage.hasMore}
            />
          </section>
        }
      />
    </main>
  );
}

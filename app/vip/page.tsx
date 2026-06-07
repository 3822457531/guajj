import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { HotSearchBoard } from "@/components/hot-search-board";
import { SearchModeTabs } from "@/components/search-mode-tabs";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { getLatestHotSearchBoard } from "@/lib/jisou-hot-search-board";

export const metadata: Metadata = {
  title: "热搜榜 · 吃瓜网",
  description: "极搜实时热搜词条，一键跳转全网搜索"
};

export const dynamic = "force-dynamic";

export default async function HotSearchPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  if (q) {
    redirect(`/global-search?q=${encodeURIComponent(q)}`);
  }

  const board = await getLatestHotSearchBoard();

  return (
    <main className="site-shell h5-home hot-board-page">
      <header className="h5-top hot-board-top">
        <div className="h5-top-row">
          <div className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                🔥
              </span>
              <span className="h5-brand-title">热搜榜</span>
            </div>
            <p className="h5-brand-sub">极搜热词 · 一键全网搜</p>
          </div>
          <Link href="/my" prefetch={false} className="vip-member-pill">
            <span aria-hidden>👑</span>
            我的身份
          </Link>
        </div>
        <SearchModeTabs active="hot" />
      </header>

      <div className="h5-container hot-board-container">
        {board ? (
          <HotSearchBoard
            items={board.items}
            updatedAt={board.createdAt}
            sourceFetchedAt={board.sourceFetchedAt}
          />
        ) : (
          <HotSearchBoard items={[]} updatedAt={new Date()} />
        )}
      </div>

      <H5SiteBottomNav active="hot" variant="dark" />
    </main>
  );
}

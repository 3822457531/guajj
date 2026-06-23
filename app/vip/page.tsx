import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GlobalSearchClient } from "@/components/global-search/global-search-client";
import { H5DiscoverShell, type DiscoverTab } from "@/components/h5-discover-shell";
import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";
import { HotSearchBoard } from "@/components/hot-search-board";
import { getLatestHotSearchBoard } from "@/lib/jisou-hot-search-board";

export const metadata: Metadata = {
  title: "吃瓜搜 · 吃瓜网",
  description: "暗网热搜与全网搜索"
};

export const dynamic = "force-dynamic";

function resolveDiscoverTab(params: { tab?: string; q?: string }): DiscoverTab {
  const q = typeof params.q === "string" ? params.q.trim() : "";
  if (params.tab === "search") return "search";
  if (params.tab === "hot") return "hot";
  return q ? "search" : "hot";
}

export default async function DiscoverPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const params = await searchParams;
  if (params.tab === "sms") redirect("/sms");
  const tab = resolveDiscoverTab(params);
  const initialQuery = typeof params.q === "string" ? params.q.trim() : "";
  const board = await getLatestHotSearchBoard();

  return (
    <main className="site-shell h5-home discover-page hot-board-page global-search-page">
      <header className="h5-top discover-top global-search-top">
        <div className="h5-top-row">
          <div className="h5-brand-block">
            <div className="h5-brand-line">
              <span className="h5-brand-flame" aria-hidden>
                🔥
              </span>
              <span className="h5-brand-title">吃瓜搜</span>
            </div>
            <p className="h5-brand-sub">
              {tab === "search" ? "暗网索引 · 视频与资源预览" : "暗网热搜 · 一键全网搜"}
            </p>
          </div>
          <Link href="/my" prefetch={false} className="vip-member-pill">
            <span aria-hidden>👑</span>
            我的身份
          </Link>
        </div>
      </header>

      <div className="h5-container discover-container global-search-container">
        <Suspense fallback={null}>
          <H5DiscoverShell
            initialTab={tab}
            hotPanel={
              board ? (
                <HotSearchBoard items={board.items} updatedAt={board.createdAt} sourceFetchedAt={board.sourceFetchedAt} />
              ) : (
                <HotSearchBoard items={[]} updatedAt={new Date()} />
              )
            }
            searchPanel={<GlobalSearchClient initialQuery={initialQuery} />}
          />
        </Suspense>
      </div>

      <H5SiteBottomNav active="discover" variant="dark" />
    </main>
  );
}

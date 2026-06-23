"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { H5StoryListCard } from "@/components/h5-story-list-card";
import type { HomeFeedItemJson } from "@/lib/home-feed";

function formatDate(iso: string | null) {
  if (!iso) return "刚刚";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function tagToneClass(name: string): string {
  const n = name.length % 3;
  if (n === 0) return "h5-rank-tag--a";
  if (n === 1) return "h5-rank-tag--b";
  return "h5-rank-tag--c";
}

export function H5HomeLatestFeed({
  initialItems,
  initialNextCursor,
  initialHasMore
}: {
  initialItems: HomeFeedItemJson[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore || !nextCursor) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fetch(`/api/home/feed?cursor=${encodeURIComponent(nextCursor)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        items: HomeFeedItemJson[];
        nextCursor: string | null;
        hasMore: boolean;
      };
      setItems((prev) => [...prev, ...data.items]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasMore, nextCursor]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "240px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  useEffect(() => {
    if (loading || !hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 240) void loadMore();
  }, [items.length, loading, hasMore, loadMore]);

  return (
    <>
      <div className="h5-story-grid">
        {items.map((item) => (
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
      {hasMore ? (
        <div ref={sentinelRef} className="h5-feed-load-more" aria-hidden={!loading}>
          {loading ? (
            <>
              <span className="h5-feed-load-spinner" />
              <span className="h5-feed-load-text">加载中…</span>
            </>
          ) : null}
        </div>
      ) : items.length > 0 ? (
        <p className="h5-feed-end">已经到底啦</p>
      ) : (
        <p className="h5-feed-end">暂无内容</p>
      )}
    </>
  );
}

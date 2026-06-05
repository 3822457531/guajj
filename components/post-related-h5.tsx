"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

export type RelatedItem = {
  id: string;
  title: string;
  category: { name: string };
};

export function PostRelatedH5({ postId, initialItems }: { postId: string; initialItems: RelatedItem[] }) {
  const [items, setItems] = useState<RelatedItem[]>(initialItems);
  const [loading, setLoading] = useState(false);

  const shuffle = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/related`, { cache: "no-store" });
      const data = (await res.json()) as { items?: RelatedItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  return (
    <section className="h5-related" aria-labelledby="h5-related-title">
      <div className="h5-related-head">
        <h2 id="h5-related-title" className="h5-related-title">
          🔥 同类推荐
        </h2>
        <button type="button" className="h5-related-refresh" disabled={loading} onClick={() => void shuffle()}>
          {loading ? "加载中…" : "换一换 🔄"}
        </button>
      </div>
      <ul className="h5-related-list">
        {items.map((item, index) => (
          <li key={item.id}>
            <Link href={`/post/${item.id}`} className="h5-related-row">
              <span className={`h5-related-rank h5-related-rank--${index % 4}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="h5-related-main">
                <span className="h5-related-row-title">{item.title}</span>
                <span className={`h5-related-tag h5-related-tag--${index % 4}`} title={item.category.name}>
                  {item.category.name}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

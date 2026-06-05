"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { buildVipListHref } from "@/lib/tg-index-display";

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function VipHotKeywords({ keywords, batchSize = 8 }: { keywords: string[]; batchSize?: number }) {
  const [visible, setVisible] = useState(() => keywords.slice(0, batchSize));

  const refresh = useCallback(() => {
    if (keywords.length <= batchSize) {
      setVisible(shuffle(keywords));
      return;
    }
    setVisible(shuffle(keywords).slice(0, batchSize));
  }, [keywords, batchSize]);

  if (visible.length === 0) return null;

  return (
    <section className="vip-hot" aria-labelledby="vip-hot-title">
      <div className="vip-hot-head">
        <h2 id="vip-hot-title" className="vip-hot-title">
          <span className="vip-hot-flame" aria-hidden>
            🔥
          </span>
          热门搜索
        </h2>
        <button type="button" className="vip-hot-refresh" onClick={refresh}>
          <span className="vip-hot-refresh-icon" aria-hidden>
            ↻
          </span>
          换一批
        </button>
      </div>
      <div className="vip-hot-tags">
        {visible.map((word) => (
          <Link key={word} href={buildVipListHref(word)} prefetch={false} className="vip-hot-tag">
            {word}
          </Link>
        ))}
      </div>
    </section>
  );
}

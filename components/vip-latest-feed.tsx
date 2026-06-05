import Link from "next/link";
import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { buildVipDetailHref, formatMessageDate } from "@/lib/tg-index-display";
import { vipSourceLabel, vipTextBadgeTone } from "@/lib/vip-result-display";

export function VipLatestFeed({ items }: { items: TgIndexedMessage[] }) {
  if (items.length === 0) return null;

  return (
    <section className="vip-latest" aria-labelledby="vip-latest-title">
      <h2 id="vip-latest-title" className="vip-latest-title">
        <span className="vip-hot-flame" aria-hidden>
          🔥
        </span>
        最新爆料
      </h2>
      <ul className="vip-latest-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={buildVipDetailHref(item.id, "")} prefetch={false} className="vip-latest-item">
              <span className={`vip-latest-badge ${vipTextBadgeTone(item.id)}`} aria-hidden>
                爆
              </span>
              <span className="vip-latest-body">
                <span className="vip-latest-heading">{item.title}</span>
                <span className="vip-latest-snippet">{item.snippet}</span>
                <span className="vip-latest-foot">
                  <span className="vip-latest-meta">
                    来自：{vipSourceLabel(item)} · {formatMessageDate(item.messageDate)}
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

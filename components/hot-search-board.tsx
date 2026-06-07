import Link from "next/link";
import type { HotSearchBoardItem } from "@/lib/jisou-hot-search-board";

function formatBoardTime(value: Date | null | undefined) {
  if (!value) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function buildGlobalSearchHref(keyword: string) {
  return `/global-search?q=${encodeURIComponent(keyword)}`;
}

function tagClassName(rank: number) {
  if (rank === 1) return "hot-board-tag hot-board-tag--hot-1";
  if (rank === 2) return "hot-board-tag hot-board-tag--hot-2";
  if (rank === 3) return "hot-board-tag hot-board-tag--hot-3";
  return "hot-board-tag";
}

export function HotSearchBoard({
  items,
  updatedAt,
  sourceFetchedAt
}: {
  items: HotSearchBoardItem[];
  updatedAt: Date;
  sourceFetchedAt?: Date | null;
}) {
  const topItems = items.filter((item) => item.group === "top");
  const moreItems = items.filter((item) => item.group === "more");
  const displayItems = [...topItems.slice(0, 6), ...moreItems];

  if (items.length === 0) {
    return (
      <section className="hot-board-empty" aria-label="热搜榜">
        <p className="hot-board-empty-title">暂无热搜数据</p>
        <p className="hot-board-empty-tip">请稍后再来，或联系管理员同步极搜热搜。</p>
      </section>
    );
  }

  return (
    <section className="hot-board" aria-label="热搜榜">
      <div className="hot-board-meta">
        <p className="hot-board-meta-line">
          共 <strong>{items.length}</strong> 条 · 更新于 {formatBoardTime(updatedAt)}
        </p>
        {sourceFetchedAt ? (
          <p className="hot-board-meta-sub">极搜采集 {formatBoardTime(sourceFetchedAt)}</p>
        ) : null}
      </div>

      <div className="hot-board-section">
        <h2 className="hot-board-section-title">今日热榜</h2>
        <div className="hot-board-tags">
          {displayItems.map((item) => (
            <Link
              key={`${item.rank}-${item.label}`}
              href={buildGlobalSearchHref(item.label)}
              prefetch={false}
              className={tagClassName(item.rank)}
            >
              {item.rank <= 3 ? (
                <span className="hot-board-tag-rank" aria-label={`第 ${item.rank} 名`}>
                  {item.rank}
                </span>
              ) : null}
              <span className="hot-board-tag-label">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <p className="hot-board-foot">点击词条跳转全网搜索 · 前三名热度最高</p>
    </section>
  );
}

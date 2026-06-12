import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import type { Post, TelegramImport } from "@/lib/generated/prisma";

export type TelegramImportRow = TelegramImport & { post: Post | null };

const PAGE_SIZES = [10, 20, 50] as const;

function importsListUrl(opts: { page?: number; size?: number }) {
  const p = new URLSearchParams();
  if (opts.page && opts.page > 1) p.set("iPage", String(opts.page));
  if (opts.size && opts.size !== 10) p.set("iSize", String(opts.size));
  const s = p.toString();
  return s ? `${adminPath("/telegram")}?${s}` : `${adminPath("/telegram")}`;
}

function snippet(raw: string, max = 96) {
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function mediaKind(mediaType: string | null | undefined): "VIDEO" | "IMAGE" | "TEXT" {
  const m = (mediaType || "").toUpperCase();
  if (m === "VIDEO") return "VIDEO";
  if (m === "IMAGE") return "IMAGE";
  return "TEXT";
}

function isVideoPath(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.includes("/uploads/") && !/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url);
}

function pageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  for (let d = 2; d <= 4; d++) {
    if (current - d >= 1) set.add(current - d);
    if (current + d <= total) set.add(current + d);
  }
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const result: (number | "gap")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push("gap");
    result.push(sorted[i]);
  }
  return result;
}

function IconDoc() {
  return (
    <svg className="tg-imports-head-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

export default function TelegramImportsSection({
  items,
  total,
  page,
  pageSize
}: {
  items: TelegramImportRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="tg-imports-card admin-panel">
      <header className="tg-imports-head">
        <div className="tg-imports-head-text">
          <div className="tg-imports-title-row">
            <IconDoc />
            <h2 className="tg-imports-title">最近采集</h2>
          </div>
          <p className="tg-imports-sub">最近采集的频道消息，实时更新</p>
        </div>

{/* 
        <AdminLink className="tg-imports-all-link" href={adminPath("/posts")}>
          查看全部内容
          <span aria-hidden> ›</span>
        </AdminLink> */}


      </header>

      <div className="tg-imports-table-wrap">
        <table className="tg-imports-table">
          <thead>
            <tr>
              <th>频道消息</th>
              <th>媒体</th>
              <th>生成内容</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="tg-imports-empty">
                  暂无采集记录。启用 TG 采集并发送频道消息后，将在此显示。
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const kind = mediaKind(item.mediaType);
                const channelName = item.chatTitle || item.chatId || "未知频道";
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="tg-imports-channel">
                        <div className="tg-imports-avatar-wrap">
                          <span className="tg-imports-avatar">🍉</span>
                          <span className="tg-imports-avatar-dot" title="已采集" />
                        </div>
                        <div className="tg-imports-channel-body">
                          <div className="tg-imports-channel-name">{channelName}</div>
                          <div className="tg-imports-tags">
                            <span className={`tg-imports-tag tg-imports-tag--${kind.toLowerCase()}`}>
                              {kind === "TEXT" ? "文字" : kind}
                            </span>
                          </div>
                          <p className="tg-imports-snippet">{snippet(item.rawText)}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="tg-imports-media-cell">
                        {item.mediaUrl ? (
                          kind === "VIDEO" || isVideoPath(item.mediaUrl) ? (
                            <div className="tg-imports-thumb tg-imports-thumb--video">
                              <video src={item.mediaUrl} muted playsInline preload="metadata" />
                              <span className="tg-imports-play" aria-hidden>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                                  <polygon points="8 5 19 12 8 19 8 5" />
                                </svg>
                              </span>
                            </div>
                          ) : (
                            <div className="tg-imports-thumb tg-imports-thumb--image">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.mediaUrl} alt="" />
                            </div>
                          )
                        ) : (
                          <div className="tg-imports-thumb tg-imports-thumb--text" title="纯文字">
                            T
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.post ? (
                        <AdminLink className="tg-imports-post-link" href={`${adminPath("/posts")}?edit=${item.post.id}`}>
                          {item.post.title}
                        </AdminLink>
                      ) : (
                        <span className="tg-imports-none">未生成</span>
                      )}
                    </td>
                    <td>
                      <div className="tg-imports-time">
                        <span className="tg-imports-time-date">
                          {new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(item.createdAt)}
                        </span>
                        <span className="tg-imports-time-clock">
                          {new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(item.createdAt)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {total > 0 ? (
        <footer className="tg-imports-footer">
          <span className="tg-imports-total">共 {total} 条</span>
          <div className="tg-imports-footer-mid">
            <span className="tg-imports-size-label">每页</span>
            <div className="tg-imports-size-links">
              {PAGE_SIZES.map((sz) => (
                <AdminLink
                  key={sz}
                  href={importsListUrl({ page: 1, size: sz })}
                  className={sz === pageSize ? "is-active" : ""}
                >
                  {sz} 条
                </AdminLink>
              ))}
            </div>
          </div>
          <div className="tg-imports-pages">
            {page > 1 ? (
              <AdminLink className="tg-imports-page-arrow" href={importsListUrl({ page: page - 1, size: pageSize })} aria-label="上一页">
                ‹
              </AdminLink>
            ) : (
              <span className="tg-imports-page-arrow is-disabled">‹</span>
            )}
            {pageItems(page, totalPages).map((p, idx) =>
              p === "gap" ? (
                <span key={`g-${idx}`} className="tg-imports-page-gap">
                  …
                </span>
              ) : p === page ? (
                <span key={p} className="tg-imports-page-num is-current">
                  {p}
                </span>
              ) : (
                <AdminLink key={p} href={importsListUrl({ page: p, size: pageSize })} className="tg-imports-page-num">
                  {p}
                </AdminLink>
              )
            )}
            {page < totalPages ? (
              <AdminLink className="tg-imports-page-arrow" href={importsListUrl({ page: page + 1, size: pageSize })} aria-label="下一页">
                ›
              </AdminLink>
            ) : (
              <span className="tg-imports-page-arrow is-disabled">›</span>
            )}
          </div>
          <form method="get" className="tg-imports-goto">
            {pageSize !== 10 ? <input type="hidden" name="iSize" value={pageSize} /> : null}
            <span>前往</span>
            <input type="number" name="iPage" min={1} max={totalPages} defaultValue={page} className="tg-imports-goto-input" />
            <span>页</span>
            <button type="submit" className="tg-imports-goto-btn">
              跳转
            </button>
          </form>
        </footer>
      ) : null}
    </section>
  );
}

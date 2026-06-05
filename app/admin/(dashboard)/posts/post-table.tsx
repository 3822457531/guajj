import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import type { Category, Post, PostStatus, PostTag, Tag } from "@/lib/generated/prisma";
import { deletePostAction } from "./actions";

type PostWithMeta = Post & { category: Category; tags: Array<PostTag & { tag: Tag }> };

export type PostListPagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  editId?: string;
};

const PAGE_SIZES = [10, 50, 100] as const;

function buildPostsUrl(opts: { edit?: string; q?: string; page?: number; perPage?: number }) {
  const p = new URLSearchParams();
  if (opts.edit) p.set("edit", opts.edit);
  if (opts.q) p.set("q", opts.q);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  const pp = opts.perPage ?? 10;
  if (pp !== 10) p.set("perPage", String(pp));
  const s = p.toString();
  return s ? `${adminPath("/posts")}?${s}` : `${adminPath("/posts")}`;
}

function formatUpdatedAt(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

const statusText: Record<PostStatus, string> = {
  PUBLISHED: "已发布",
  DRAFT: "草稿",
  ARCHIVED: "已下架"
};

const statusPillClass: Record<PostStatus, string> = {
  PUBLISHED: "post-status-pill post-status-published",
  DRAFT: "post-status-pill post-status-draft",
  ARCHIVED: "post-status-pill post-status-archived"
};

function IconPencil() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export default function PostTable({
  posts,
  listQuery = "",
  pagination
}: {
  posts: PostWithMeta[];
  listQuery?: string;
  pagination: PostListPagination;
}) {
  const { total, page, pageSize, totalPages, editId } = pagination;

  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>标题</th>
              <th>状态</th>
              <th>分类</th>
              <th>浏览量</th>
              <th>更新时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ color: "var(--muted)", textAlign: "center", padding: "28px 12px" }}>
                  {listQuery ? "没有匹配的内容，请换个关键词试试。" : "暂无内容，请在左侧新建。"}
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr key={post.id} className={post.isPinned ? "admin-post-row-pinned" : undefined}>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 10px" }}>
                      {post.isPinned ? (
                        <span className="post-pinned-badge" title="首页轮播置顶">
                          👑 置顶
                        </span>
                      ) : null}
                      <strong style={{ flex: "1 1 12rem", minWidth: 0 }}>{post.title}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                      {post.tags.map(({ tag }) => `#${tag.name}`).join(" ")}
                    </div>
                  </td>
                  <td>
                    <span className={statusPillClass[post.status]}>{statusText[post.status]}</span>
                  </td>
                  <td>{post.category.name}</td>
                  <td>{post.views}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatUpdatedAt(post.updatedAt)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <AdminLink
                        className="admin-icon-action"
                        href={buildPostsUrl({
                          edit: post.id,
                          q: listQuery || undefined,
                          page: page > 1 ? page : undefined,
                          perPage: pageSize
                        })}
                        title="编辑"
                        aria-label="编辑"
                      >
                        <IconPencil />
                      </AdminLink>
                      <form action={deletePostAction.bind(null, post.id)} title="删除">
                        <button className="admin-icon-action danger" type="submit" aria-label="删除">
                          <IconTrash />
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="admin-table-pagination">
        <span>
          共 {total} 条{total ? ` · 每页 ${pageSize} 条` : ""}
        </span>
        <div className="admin-pagination-row">
          <div className="admin-per-page" role="group" aria-label="每页条数">
            <span className="admin-per-page-label">每页</span>
            {PAGE_SIZES.map((n) =>
              pageSize === n ? (
                <span key={n} className="admin-per-page-opt is-active" aria-current="true">
                  {n}
                </span>
              ) : (
                <AdminLink
                  key={n}
                  href={buildPostsUrl({ edit: editId, q: listQuery || undefined, perPage: n })}
                  className="admin-per-page-opt"
                >
                  {n}
                </AdminLink>
              )
            )}
          </div>
          <div className="admin-pagination-pages">
            {page > 1 ? (
              <AdminLink href={buildPostsUrl({ edit: editId, q: listQuery || undefined, page: page - 1, perPage: pageSize })}>上一页</AdminLink>
            ) : (
              <span style={{ opacity: 0.4 }}>上一页</span>
            )}
            <span>
              第 {page} / {totalPages} 页
            </span>
            {page < totalPages ? (
              <AdminLink href={buildPostsUrl({ edit: editId, q: listQuery || undefined, page: page + 1, perPage: pageSize })}>下一页</AdminLink>
            ) : (
              <span style={{ opacity: 0.4 }}>下一页</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

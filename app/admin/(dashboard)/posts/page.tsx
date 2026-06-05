import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/prisma";
import PostForm from "./post-form";
import PostTable from "./post-table";

const ALLOWED_PAGE_SIZES = [10, 50, 100] as const;

function parsePageSize(raw: string | undefined): number {
  const n = Math.floor(Number(raw));
  return ALLOWED_PAGE_SIZES.includes(n as (typeof ALLOWED_PAGE_SIZES)[number]) ? n : 10;
}

export default async function AdminPostsPage({
  searchParams
}: {
  searchParams: Promise<{
    edit?: string;
    error?: string;
    saved?: string;
    deleted?: string;
    q?: string;
    page?: string;
    perPage?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const pageSize = parsePageSize(params.perPage);
  const rawPage = Math.max(1, Math.floor(Number(params.page) || 1));
  const listWhere: Prisma.PostWhereInput | undefined = q
    ? {
        OR: [
          { title: { contains: q } },
          { summary: { contains: q } },
          { body: { contains: q } },
          { category: { name: { contains: q } } },
          { tags: { some: { tag: { name: { contains: q } } } } }
        ]
      }
    : undefined;

  const total = await prisma.post.count({ where: listWhere });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(rawPage, totalPages);

  const [posts, categories, tags] = await Promise.all([
    prisma.post.findMany({
      where: listWhere,
      include: { category: true, tags: { include: { tag: true } } },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.tag.findMany({ orderBy: { name: "asc" } })
  ]);
  const editingPost = params.edit
    ? await prisma.post.findUnique({
        where: { id: params.edit },
        include: { tags: { include: { tag: true } } }
      })
    : null;

  const clearSearchHref = (() => {
    const p = new URLSearchParams();
    if (params.edit) p.set("edit", params.edit);
    if (pageSize !== 10) p.set("perPage", String(pageSize));
    const s = p.toString();
    return s ? `${adminPath("/posts")}?${s}` : `${adminPath("/posts")}`;
  })();

  const newPostHref = pageSize === 10 ? `${adminPath("/posts")}` : `${adminPath("/posts")}?perPage=${pageSize}`;

  return (
    <>
      {params.saved ? <p className="admin-flash success">内容已保存。</p> : null}
      {params.deleted ? <p className="admin-flash success">内容已删除。</p> : null}
      <div className="two-col">
        <PostForm post={editingPost} categories={categories} tags={tags} hasError={params.error === "missing"} />
        <section className="admin-panel">
          <div className="admin-list-toolbar">
            <form method="get" action={adminPath("/posts")} className="admin-post-search">
              {params.edit ? <input type="hidden" name="edit" value={params.edit} /> : null}
              {pageSize !== 10 ? <input type="hidden" name="perPage" value={String(pageSize)} /> : null}
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="搜索标题、摘要、正文、分类、标签…"
                autoComplete="off"
              />
              <button type="submit" className="btn-admin-ghost">
                查询
              </button>
              {q ? (
                <AdminLink className="btn-admin-ghost" href={clearSearchHref} style={{ textDecoration: "none", display: "inline-flex" }}>
                  清除
                </AdminLink>
              ) : null}
            </form>
            <AdminLink className="btn btn-admin-primary" href={newPostHref} style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
              ＋ 新建内容
            </AdminLink>
          </div>
          {q ? <p className="admin-list-meta">关键词「{q}」本页 {posts.length} 条 · 共 {total} 条匹配</p> : null}
          <PostTable
            posts={posts}
            listQuery={q}
            pagination={{ total, page, pageSize, totalPages, editId: params.edit }}
          />
        </section>
      </div>
    </>
  );
}

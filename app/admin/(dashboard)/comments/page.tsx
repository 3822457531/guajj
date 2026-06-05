import { prisma } from "@/lib/prisma";
import CommentTable from "./comment-table";

export default async function AdminCommentsPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const params = await searchParams;
  const rows = await prisma.comment.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      post: { select: { id: true, title: true } },
      author: true
    }
  });

  return (
    <>
      {params.deleted ? <p className="admin-flash success">评论已删除。</p> : null}
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        按发表时间倒序，最多展示 300 条。删除后对应文章详情页评论会更新。
      </p>
      {rows.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>暂无评论。</p>
      ) : (
        <div className="admin-panel" style={{ padding: 0, overflow: "hidden" }}>
          <CommentTable rows={rows} />
        </div>
      )}
    </>
  );
}

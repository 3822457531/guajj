import AdminLink from "@/components/admin-link";
import type { Comment, Post, SocialUser } from "@/lib/generated/prisma";
import { deleteCommentAction } from "./actions";

export type AdminCommentRow = Comment & {
  post: Pick<Post, "id" | "title">;
  author: SocialUser;
};

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function snippet(text: string, max = 80) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export default function CommentTable({ rows }: { rows: AdminCommentRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>文章</th>
            <th>作者</th>
            <th>内容</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.createdAt)}</td>
              <td>
                <AdminLink href={`/post/${row.post.id}`} target="_blank" rel="noreferrer">
                  {row.post.title}
                </AdminLink>
              </td>
              <td>
                {row.author.nickname}
                <br />
                <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.author.loginType}</span>
              </td>
              <td style={{ maxWidth: 320, fontSize: 14 }}>{snippet(row.body)}</td>
              <td>
                <form action={deleteCommentAction.bind(null, row.id)}>
                  <button className="btn secondary" type="submit">
                    删除
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

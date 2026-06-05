import type { SocialUser } from "@/lib/generated/prisma";
import { deleteSocialUserAction } from "./actions";

export type AdminSocialUserRow = SocialUser & {
  _count: { comments: number };
};

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function maskUid(uid: string) {
  if (uid.length <= 10) return uid;
  return `${uid.slice(0, 4)}…${uid.slice(-4)}`;
}

export default function SocialUsersTable({
  rows,
  visitCounts
}: {
  rows: AdminSocialUserRow[];
  visitCounts: Map<string, number>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>头像</th>
            <th>昵称</th>
            <th>渠道</th>
            <th>平台 UID</th>
            <th>上次登录</th>
            <th>注册时间</th>
            <th>近 7 天访问</th>
            <th>评论数</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.faceimg?.trim() ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={row.faceimg}
                    alt=""
                    width={40}
                    height={40}
                    style={{ borderRadius: "50%", objectFit: "cover", display: "block", background: "#222" }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span
                    style={{
                      display: "inline-flex",
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--admin-accent-soft, rgba(255,140,0,0.2))",
                      fontWeight: 800,
                      fontSize: 16
                    }}
                    aria-hidden
                  >
                    {(row.nickname || "?").slice(0, 1)}
                  </span>
                )}
              </td>
              <td style={{ fontWeight: 700 }}>{row.nickname || "—"}</td>
              <td>
                <code style={{ fontSize: 13 }}>{row.loginType}</code>
                {row.location ? (
                  <>
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.location}</span>
                  </>
                ) : null}
              </td>
              <td style={{ fontSize: 12, color: "var(--muted)", wordBreak: "break-all", maxWidth: 140 }} title={row.socialUid}>
                {maskUid(row.socialUid)}
              </td>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.lastLoginAt)}</td>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.createdAt)}</td>
              <td style={{ textAlign: "center" }}>{visitCounts.get(row.id) ?? 0}</td>
              <td style={{ textAlign: "center" }}>{row._count.comments}</td>
              <td>
                <form action={deleteSocialUserAction.bind(null, row.id)}>
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

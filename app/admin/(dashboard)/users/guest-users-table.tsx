import type { GuestUser } from "@/lib/generated/prisma";
import { deleteGuestUserAction } from "./actions";

export type AdminGuestUserRow = GuestUser & {
  referrer: { publicId: string } | null;
  _count: { referrals: number; searchLogs: number };
  todaySearchCount: number;
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

export default function GuestUsersTable({ rows }: { rows: AdminGuestUserRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>用户 ID</th>
            <th>推广码</th>
            <th>推广人</th>
            <th>邀请奖励</th>
            <th>邀请人数</th>
            <th>今日搜索</th>
            <th>累计搜索</th>
            <th>注册 IP</th>
            <th>上次登录 IP</th>
            <th>上次登录</th>
            <th>注册时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <code style={{ fontSize: 13, fontWeight: 700 }}>{row.publicId}</code>
              </td>
              <td>
                <code style={{ fontSize: 13 }}>{row.publicId}</code>
              </td>
              <td style={{ fontSize: 13 }}>
                {row.referrer ? (
                  <code>{row.referrer.publicId}</code>
                ) : (
                  <span style={{ color: "var(--muted)" }}>—</span>
                )}
              </td>
              <td style={{ textAlign: "center", fontWeight: 700 }}>+{row.searchBonus}</td>
              <td style={{ textAlign: "center" }}>{row._count.referrals}</td>
              <td style={{ textAlign: "center" }}>{row.todaySearchCount}</td>
              <td style={{ textAlign: "center" }}>{row._count.searchLogs}</td>
              <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{row.registerIp ?? "—"}</td>
              <td style={{ fontSize: 12, fontFamily: "ui-monospace, monospace" }}>{row.lastLoginIp ?? "—"}</td>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.lastLoginAt)}</td>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.createdAt)}</td>
              <td>
                <form action={deleteGuestUserAction.bind(null, row.id)}>
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

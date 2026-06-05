import {
  getAnalyticsOverview,
  getDailyTrend,
  getRecentVisits,
  getTopPaths
} from "@/lib/analytics";
import { getGuestUserStatsOverview } from "@/lib/guest-user";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(value);
}

export default async function AdminAnalyticsPage() {
  const [overview, trend, topPaths, recentVisits, guestStats] = await Promise.all([
    getAnalyticsOverview(),
    getDailyTrend(14),
    getTopPaths(10),
    getRecentVisits(50),
    getGuestUserStatsOverview()
  ]);

  return (
    <>
      <div className="admin-grid">
        <div className="admin-card admin-stat-card">
          今日 PV<strong>{overview.today.pageViews}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          今日 UV<strong>{overview.today.uniqueVisitors}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          今日登录访问<strong>{overview.today.loggedInPageViews}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          今日新增用户<strong>{guestStats.todayNew}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          匿名用户总数<strong>{guestStats.total}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          近 7 天新增用户<strong>{guestStats.weekNew}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          近 7 天 PV<strong>{overview.week.pageViews}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          近 7 天 UV<strong>{overview.week.uniqueVisitors}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          近 7 天活跃登录用户<strong>{overview.activeLoggedInUsers}</strong>
        </div>
      </div>

      <p className="admin-page-note" style={{ marginTop: 0 }}>
        昨日 PV {overview.yesterday.pageViews} · UV {overview.yesterday.uniqueVisitors} · 登录访问{" "}
        {overview.yesterday.loggedInPageViews} · 新增用户 {guestStats.yesterdayNew}。统计范围：全部前台页面（首页、文章、VIP
        等），不含后台与 API。「新增用户」为 GUA 匿名自动注册数。
      </p>

      <div className="admin-panel" style={{ marginBottom: 24 }}>
        <h2 className="admin-panel-title">近 14 天趋势</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>PV</th>
                <th>UV</th>
                <th>登录访问</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>{row.pageViews}</td>
                  <td>{row.uniqueVisitors}</td>
                  <td>{row.loggedInPageViews}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
        <div className="admin-panel">
          <h2 className="admin-panel-title">近 7 天 Top 路径</h2>
          {topPaths.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>暂无访问记录。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>路径</th>
                    <th>访问次数</th>
                  </tr>
                </thead>
                <tbody>
                  {topPaths.map((row) => (
                    <tr key={row.path}>
                      <td>
                        <code style={{ fontSize: 13, wordBreak: "break-all" }}>{row.path}</code>
                      </td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="admin-panel">
          <h2 className="admin-panel-title">最近访问</h2>
          {recentVisits.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>暂无访问记录。</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>路径</th>
                    <th>IP</th>
                    <th>登录用户</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((row) => (
                    <tr key={row.id}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.createdAt)}</td>
                      <td>
                        <code style={{ fontSize: 12, wordBreak: "break-all" }}>{row.path}</code>
                      </td>
                      <td style={{ fontSize: 13 }}>{row.ip}</td>
                      <td style={{ fontSize: 13 }}>
                        {row.socialUser ? (
                          <>
                            {row.socialUser.nickname}
                            <br />
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>{row.socialUser.loginType}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

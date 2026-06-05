import type { SearchLog, SocialUser } from "@/lib/generated/prisma";
import {
  getRecentSearchLogs,
  getSearchStatsOverview,
  SearchSource,
  type SearchStatsSlice
} from "@/lib/search-analytics";

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

type SearchLogRow = SearchLog & {
  socialUser: Pick<SocialUser, "id" | "nickname" | "loginType"> | null;
};

function TopKeywordsTable({ rows }: { rows: Array<{ keyword: string; count: number }> }) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>暂无数据。</p>;
  }
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>#</th>
          <th>关键词</th>
          <th>次数</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.keyword}>
            <td>{index + 1}</td>
            <td>{row.keyword}</td>
            <td>{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SearchLogsTable({ rows }: { rows: SearchLogRow[] }) {
  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>暂无搜索记录。</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>关键词</th>
            <th>结果数</th>
            <th>IP</th>
            <th>登录用户</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.createdAt)}</td>
              <td style={{ fontWeight: 600 }}>{row.keyword}</td>
              <td>{row.resultCount}</td>
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
  );
}

function SearchSourcePanel({
  title,
  scopeNote,
  stats,
  recentLogs
}: {
  title: string;
  scopeNote: string;
  stats: SearchStatsSlice;
  recentLogs: SearchLogRow[];
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 className="admin-panel-title" style={{ fontSize: 18, marginBottom: 8 }}>
        {title}
      </h2>
      <p className="admin-page-note" style={{ marginTop: 0, marginBottom: 16 }}>
        {scopeNote}
      </p>

      <div className="admin-grid" style={{ marginBottom: 20 }}>
        <div className="admin-card admin-stat-card">
          今日搜索<strong>{stats.todayCount}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          近 7 天搜索<strong>{stats.weekCount}</strong>
        </div>
        <div className="admin-card admin-stat-card">
          累计记录<strong>{stats.totalCount}</strong>
        </div>
      </div>

      <div className="admin-grid" style={{ gridTemplateColumns: "1fr 1fr", alignItems: "start", marginBottom: 20 }}>
        <div className="admin-panel">
          <h3 className="admin-panel-title">今日热搜 Top 15</h3>
          <TopKeywordsTable rows={stats.todayTop} />
        </div>
        <div className="admin-panel">
          <h3 className="admin-panel-title">近 7 天热搜 Top 15</h3>
          <TopKeywordsTable rows={stats.weekTop} />
        </div>
      </div>

      <div className="admin-panel">
        <h3 className="admin-panel-title">搜索明细（最近 100 条）</h3>
        <SearchLogsTable rows={recentLogs} />
      </div>
    </section>
  );
}

export default async function AdminSearchAnalyticsPage() {
  const [overview, homeLogs, vipLogs] = await Promise.all([
    getSearchStatsOverview(),
    getRecentSearchLogs(SearchSource.HOME, 100),
    getRecentSearchLogs(SearchSource.VIP, 100)
  ]);

  return (
    <>
      <SearchSourcePanel
        title="首页搜索"
        scopeNote="统计范围：`/?q=…` 提交的全站帖子关键词搜索。每次搜索记一条；翻页不重复记（仅首页搜索无分页）。"
        stats={overview.home}
        recentLogs={homeLogs}
      />

      <SearchSourcePanel
        title="VIP 搜索"
        scopeNote="统计范围：`/vip?q=…` 提交的频道索引搜索。每次新搜索记一条（翻页不重复）；结果数为索引命中总数。"
        stats={overview.vip}
        recentLogs={vipLogs}
      />
    </>
  );
}

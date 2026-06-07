import type { SearchLog, SocialUser } from "@/lib/generated/prisma";
import {
  getRecentSearchLogs,
  getSearchStatsForSource,
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
  guestUser: { id: string; publicId: string } | null;
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

function SearchLogsTable({ rows, showGuest }: { rows: SearchLogRow[]; showGuest?: boolean }) {
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
            {showGuest ? <th>GUA 用户</th> : null}
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
              {showGuest ? (
                <td style={{ fontSize: 13 }}>{row.guestUser?.publicId ?? "—"}</td>
              ) : null}
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
  recentLogs,
  showGuest
}: {
  title: string;
  scopeNote: string;
  stats: SearchStatsSlice;
  recentLogs: SearchLogRow[];
  showGuest?: boolean;
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
        <SearchLogsTable rows={recentLogs} showGuest={showGuest} />
      </div>
    </section>
  );
}

export default async function AdminSearchAnalyticsPage() {
  const [globalStats, globalLogs] = await Promise.all([
    getSearchStatsForSource(SearchSource.GLOBAL),
    getRecentSearchLogs(SearchSource.GLOBAL, 100)
  ]);

  return (
    <>
      <SearchSourcePanel
        title="全网搜索"
        scopeNote="统计范围：`/global-search` 暗网索引搜索。极搜返回频道列表后扣 1 次额度并记一条明细；验证码阶段不扣次。"
        stats={globalStats}
        recentLogs={globalLogs}
        showGuest
      />
    </>
  );
}

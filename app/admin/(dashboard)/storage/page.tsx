import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import { formatBytes, getStorageMonitorReport, type StorageScanResult, type StorageStats } from "@/lib/storage-stats";
import StorageRefreshButton from "./refresh-button";

export const dynamic = "force-dynamic";

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

function StatCards({ stats, label }: { stats: StorageStats; label: string }) {
  return (
    <div className="admin-grid">
      <div className="admin-card admin-stat-card">
        {label} 文件总数<strong>{stats.totalCount}</strong>
      </div>
      <div className="admin-card admin-stat-card">
        图片<strong>{stats.imageCount}</strong>
      </div>
      <div className="admin-card admin-stat-card">
        视频<strong>{stats.videoCount}</strong>
      </div>
      <div className="admin-card admin-stat-card">
        其他<strong>{stats.otherCount}</strong>
      </div>
      <div className="admin-card admin-stat-card">
        占用空间<strong>{formatBytes(stats.totalBytes)}</strong>
      </div>
    </div>
  );
}

function ScanPanel({
  title,
  result,
  note
}: {
  title: string;
  result: StorageScanResult;
  note?: string;
}) {
  return (
    <div className="admin-panel" style={{ marginBottom: 24 }}>
      <h2 className="admin-panel-title">{title}</h2>
      {note ? (
        <p className="admin-page-note" style={{ marginTop: 0 }}>
          {note}
        </p>
      ) : null}
      {!result.ok ? (
        <p style={{ color: "var(--danger, #c0392b)" }}>{result.error ?? "扫描失败"}</p>
      ) : !result.stats || result.stats.totalCount === 0 ? (
        <p style={{ color: "var(--muted)" }}>暂无文件。</p>
      ) : (
        <>
          <StatCards stats={result.stats} label={title} />
          <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>按目录分布</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>前缀</th>
                  <th>文件数</th>
                  <th>占用</th>
                </tr>
              </thead>
              <tbody>
                {result.stats.prefixBreakdown.map((row) => (
                  <tr key={row.prefix}>
                    <td>
                      <code style={{ fontSize: 13 }}>{row.prefix}</code>
                    </td>
                    <td>{row.count}</td>
                    <td>{formatBytes(row.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>最大文件（Top 15）</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>路径 / Key</th>
                  <th>类型</th>
                  <th>大小</th>
                  <th>更新时间</th>
                </tr>
              </thead>
              <tbody>
                {result.stats.largestFiles.map((row) => (
                  <tr key={row.key}>
                    <td>
                      <code style={{ fontSize: 12, wordBreak: "break-all" }}>{row.key}</code>
                    </td>
                    <td>{row.kind === "image" ? "图片" : row.kind === "video" ? "视频" : "其他"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatBytes(row.size)}</td>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                      {row.lastModified ? formatDateTime(row.lastModified) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        扫描时间：{formatDateTime(result.scannedAt)}
      </p>
    </div>
  );
}

export default async function AdminStoragePage() {
  const report = await getStorageMonitorReport();

  const activeLabel = report.activeStorage === "r2" ? "Cloudflare R2" : "本地 public/uploads";
  const r2Note =
    report.activeStorage === "r2"
      ? "当前站点写入目标。对象 Key 统一为 uploads/…"
      : "已在设置中启用 R2 配置，但当前写入仍为本地；以下为桶内已有对象统计。";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <StorageRefreshButton />
      </div>
      <p className="admin-page-note" style={{ marginTop: 0 }}>
        当前媒体存储：<strong>{activeLabel}</strong>
        {report.bucketName ? (
          <>
            {" "}
            · 桶 <code style={{ fontSize: 12 }}>{report.bucketName}</code>
          </>
        ) : null}
        {report.publicBaseUrl ? (
          <>
            {" "}
            · 公网前缀{" "}
            <a href={report.publicBaseUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>
              {report.publicBaseUrl}
            </a>
          </>
        ) : null}
        。统计于 {formatDateTime(report.scannedAt)}；桶内文件较多时首次加载可能稍慢。
        {!report.r2Ready ? (
          <>
            {" "}
            若使用 R2，请先在 <AdminLink href={adminPath("/settings")}>站点设置</AdminLink> 中配置并选择 R2 存储。
          </>
        ) : null}
      </p>

      {report.r2 ? <ScanPanel title="Cloudflare R2 存储桶" result={report.r2} note={r2Note} /> : null}

      <ScanPanel
        title="本地 uploads 目录"
        result={report.local}
        note={
          report.activeStorage === "local"
            ? "public/uploads 下所有文件（含 R2 上传失败时的本地回退）。"
            : "本地磁盘上的 uploads 目录，可能含历史文件或上传 R2 失败时的回退文件。"
        }
      />
    </>
  );
}

import { adminPath } from "@/lib/admin-path";
import AdminLink from "@/components/admin-link";
import {
  formatBytes,
  getStorageMonitorReport,
  listStorageObjectsDetailed,
  type StorageScanResult,
  type StorageSort,
  type StorageStats
} from "@/lib/storage-stats";
import StorageRefreshButton from "./refresh-button";
import { StorageObjectTable } from "./storage-object-table";
import { StorageBrowseControls } from "./storage-prefix-picker";

export const dynamic = "force-dynamic";

const SORT_VALUES: StorageSort[] = ["date_desc", "date_asc", "size_desc", "size_asc", "key_asc"];

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

function parseSort(value?: string): StorageSort {
  if (value && SORT_VALUES.includes(value as StorageSort)) return value as StorageSort;
  return "date_desc";
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
  note,
  showDelete = false
}: {
  title: string;
  result: StorageScanResult;
  note?: string;
  showDelete?: boolean;
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
                  <th>含义</th>
                  <th>文件数</th>
                  <th>占用</th>
                </tr>
              </thead>
              <tbody>
                {result.stats.prefixBreakdown.map((row) => {
                  const meaning =
                    row.prefix === "uploads/tg-index/"
                      ? "首页索引"
                      : row.prefix === "uploads/tg-search/"
                        ? "用户搜索"
                        : row.prefix === "uploads/telegram/"
                          ? "Telegram"
                          : "—";
                  return (
                    <tr key={row.prefix}>
                      <td>
                        <AdminLink
                          href={`${adminPath("/storage")}?prefix=${encodeURIComponent(row.prefix)}&sort=size_desc&limit=1000`}
                        >
                          <code style={{ fontSize: 13 }}>{row.prefix}</code>
                        </AdminLink>
                      </td>
                      <td>{meaning}</td>
                      <td>{row.count}</td>
                      <td>{formatBytes(row.bytes)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>最大文件（Top 15）</h3>
          <StorageObjectTable rows={result.stats.largestFiles} selectable={showDelete} />
        </>
      )}
      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        扫描时间：{formatDateTime(result.scannedAt)}
      </p>
    </div>
  );
}

export default async function AdminStoragePage({
  searchParams
}: {
  searchParams: Promise<{
    prefix?: string;
    sort?: string;
    limit?: string;
    token?: string;
    deleted?: string;
    indexDeleted?: string;
    homeKeys?: string;
    searchKeys?: string;
    mediaFailed?: string;
    error?: string;
    key?: string;
  }>;
}) {
  const params = await searchParams;
  const report = await getStorageMonitorReport();
  const browsePrefix = params.prefix?.trim() || "uploads/";
  const browseSort = parseSort(params.sort);
  const browseLimit = Math.min(5000, Math.max(50, Number(params.limit) || 1000));
  const browseToken = params.token?.trim() || undefined;
  const browse = await listStorageObjectsDetailed({
    prefix: browsePrefix,
    sort: browseSort,
    limit: browseLimit,
    continuationToken: browseToken
  });

  const activeLabel = report.activeStorage === "r2" ? "Cloudflare R2" : "本地 public/uploads";
  const r2Note =
    report.activeStorage === "r2"
      ? "当前站点写入目标。对象 Key 统一为 uploads/…，可直接删除 R2 对象。"
      : "已在设置中启用 R2 配置，但当前写入仍为本地；以下为桶内已有对象统计。";

  const nextHref = browse.nextToken
    ? `${adminPath("/storage")}?${new URLSearchParams({
        prefix: browsePrefix,
        sort: browseSort,
        limit: String(browseLimit),
        token: browse.nextToken
      }).toString()}`
    : null;

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <StorageRefreshButton />
      </div>

      {params.deleted ? (
        <p className="admin-flash success">
          已删除存储对象 {params.deleted} 个
          {params.indexDeleted ? <>；同步硬删首页索引 {params.indexDeleted} 条</> : null}
          {params.homeKeys ? <>（含首页资源 {params.homeKeys}）</> : null}
          {params.searchKeys ? <>（含搜索资源 {params.searchKeys}）</> : null}
          {params.mediaFailed ? <>；失败 {params.mediaFailed}</> : null}
          {params.key ? (
            <>
              ：<code style={{ fontSize: 12 }}>{params.key}</code>
            </>
          ) : null}
          。
        </p>
      ) : null}
      {params.error ? (
        <p className="admin-flash" style={{ color: "var(--danger, #c0392b)" }}>
          删除失败：{params.error}
        </p>
      ) : null}

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
        。删除 <strong>首页索引</strong>（<code>uploads/tg-index/</code>）时会硬删除关联首页 index 记录；
        <strong>用户搜索</strong>（<code>uploads/tg-search/</code>）仅删对象文件。
        {!report.r2Ready ? (
          <>
            {" "}
            若使用 R2，请先在 <AdminLink href={adminPath("/settings")}>站点设置</AdminLink> 中配置并选择 R2 存储。
          </>
        ) : null}
      </p>

      {report.r2 ? <ScanPanel title="Cloudflare R2 存储桶" result={report.r2} note={r2Note} showDelete /> : null}

      <ScanPanel
        title="本地 uploads 目录"
        result={report.local}
        note={
          report.activeStorage === "local"
            ? "public/uploads 下所有文件（含 R2 上传失败时的本地回退）。"
            : "本地磁盘上的 uploads 目录，可能含历史文件或上传 R2 失败时的回退文件。"
        }
        showDelete
      />

      <div className="admin-panel">
        <h2 className="admin-panel-title">文件管理（全量浏览 / 排序 / 批量删除）</h2>
        <p className="admin-page-note" style={{ marginTop: 0 }}>
          可按分类前缀浏览，按时间或大小排序，支持全选与批量删除。默认列出最多 {browseLimit}{" "}
          条；若仍有后续对象可点「加载更多」。
        </p>
        <StorageBrowseControls currentPrefix={browsePrefix} currentSort={browseSort} currentLimit={browseLimit} />
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 10px" }}>
          本页 {browse.listedCount} 个文件
          {browse.truncated ? "（还有更多，可加载下一页）" : ""}
          {browseToken ? " · 续页中" : ""}
        </p>
        <StorageObjectTable rows={browse.rows} selectable />
        {nextHref ? (
          <div style={{ marginTop: 14 }}>
            <AdminLink href={nextHref} className="btn secondary">
              加载更多（下一页）
            </AdminLink>
          </div>
        ) : null}
      </div>
    </>
  );
}

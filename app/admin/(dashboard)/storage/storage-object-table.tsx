"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteStorageObjectAction, batchDeleteStorageObjectsAction } from "./actions";
import {
  formatBytes,
  STORAGE_CATEGORY_LABEL,
  type StorageCategory,
  type StorageObjectRow
} from "@/lib/storage-stats-shared";

function formatDateTime(value?: Date | string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function categoryTone(category: StorageCategory) {
  switch (category) {
    case "home_index":
      return { bg: "rgba(255, 87, 34, 0.12)", color: "#e65100" };
    case "user_search":
      return { bg: "rgba(33, 150, 243, 0.12)", color: "#1565c0" };
    case "telegram":
      return { bg: "rgba(0, 150, 136, 0.12)", color: "#00695c" };
    default:
      return { bg: "rgba(0,0,0,0.06)", color: "#616161" };
  }
}

export function StorageObjectTable({
  rows,
  selectable = false
}: {
  rows: StorageObjectRow[];
  selectable?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedKeys = useMemo(
    () => rows.filter((row) => selected[row.key]).map((row) => row.key),
    [rows, selected]
  );
  const selectedHomeCount = selectedKeys.filter((k) => k.startsWith("uploads/tg-index/")).length;
  const selectedSearchCount = selectedKeys.filter((k) => k.startsWith("uploads/tg-search/")).length;
  const allChecked = rows.length > 0 && rows.every((row) => selected[row.key]);

  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>暂无文件。</p>;
  }

  function toggleAll(checked: boolean) {
    if (!checked) {
      setSelected({});
      return;
    }
    const next: Record<string, boolean> = {};
    for (const row of rows) next[row.key] = true;
    setSelected(next);
  }

  function confirmDeleteMessage(keys: string[]) {
    const home = keys.filter((k) => k.startsWith("uploads/tg-index/")).length;
    const search = keys.filter((k) => k.startsWith("uploads/tg-search/")).length;
    const lines = [
      `确定删除选中的 ${keys.length} 个存储对象？`,
      "",
      home ? `· 首页索引：${home} 个（将硬删除关联首页 index 记录）` : null,
      search ? `· 用户搜索：${search} 个` : null,
      keys.length - home - search ? `· 其他：${keys.length - home - search} 个` : null,
      "",
      "此操作不可恢复。"
    ].filter(Boolean);
    return confirm(lines.join("\n"));
  }

  function deleteOne(key: string) {
    if (!confirmDeleteMessage([key])) return;
    startTransition(() => {
      void deleteStorageObjectAction(key);
    });
  }

  function deleteSelected() {
    if (selectedKeys.length === 0) return;
    if (!confirmDeleteMessage(selectedKeys)) return;
    const data = new FormData();
    for (const key of selectedKeys) data.append("keys", key);
    startTransition(() => {
      void batchDeleteStorageObjectsAction(data);
    });
  }

  return (
    <div>
      {selectable ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            已选 {selectedKeys.length} 项
            {selectedHomeCount ? ` · 首页索引 ${selectedHomeCount}` : ""}
            {selectedSearchCount ? ` · 用户搜索 ${selectedSearchCount}` : ""}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn ghost" disabled={pending} onClick={() => toggleAll(!allChecked)}>
              {allChecked ? "取消全选" : "全选本页"}
            </button>
            <button
              type="button"
              className="btn ghost"
              disabled={pending || selectedKeys.length === 0}
              onClick={deleteSelected}
              style={{ color: "var(--danger, #c0392b)" }}
            >
              {pending ? "删除中…" : `批量删除${selectedKeys.length ? ` (${selectedKeys.length})` : ""}`}
            </button>
          </div>
        </div>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              {selectable ? (
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={(e) => toggleAll(e.target.checked)}
                    aria-label="全选"
                  />
                </th>
              ) : null}
              <th>分类</th>
              <th>路径 / Key</th>
              <th>类型</th>
              <th>大小</th>
              <th>更新时间</th>
              <th style={{ width: 72 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = categoryTone(row.category);
              return (
                <tr key={row.key}>
                  {selectable ? (
                    <td>
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.key])}
                        onChange={(e) =>
                          setSelected((prev) => ({
                            ...prev,
                            [row.key]: e.target.checked
                          }))
                        }
                      />
                    </td>
                  ) : null}
                  <td>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: tone.bg,
                        color: tone.color,
                        whiteSpace: "nowrap"
                      }}
                    >
                      {STORAGE_CATEGORY_LABEL[row.category]}
                    </span>
                  </td>
                  <td>
                    <code style={{ fontSize: 12, wordBreak: "break-all" }}>{row.key}</code>
                  </td>
                  <td>{row.kind === "image" ? "图片" : row.kind === "video" ? "视频" : "其他"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatBytes(row.size)}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDateTime(row.lastModified)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={pending}
                      onClick={() => deleteOne(row.key)}
                      style={{ color: "var(--danger, #c0392b)", fontSize: 13, padding: "4px 8px" }}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

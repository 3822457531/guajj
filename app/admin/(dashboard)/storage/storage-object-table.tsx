"use client";

import { useTransition } from "react";
import { deleteStorageObjectAction, batchDeleteStorageObjectsAction } from "./actions";
import { formatBytes, type StorageObjectRow } from "@/lib/storage-stats-shared";

function formatDateTime(value?: Date) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

export function StorageObjectTable({
  rows,
  selectable = false
}: {
  rows: StorageObjectRow[];
  selectable?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (rows.length === 0) {
    return <p style={{ color: "var(--muted)" }}>暂无文件。</p>;
  }

  function deleteOne(key: string) {
    if (!confirm(`确定删除存储对象？\n\n${key}\n\n此操作不可恢复。`)) return;
    startTransition(() => {
      void deleteStorageObjectAction(key);
    });
  }

  function deleteSelected(form: HTMLFormElement) {
    const data = new FormData(form);
    const keys = data.getAll("keys");
    if (keys.length === 0) return;
    if (!confirm(`确定删除选中的 ${keys.length} 个文件？此操作不可恢复。`)) return;
    startTransition(() => {
      void batchDeleteStorageObjectsAction(data);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        deleteSelected(e.currentTarget);
      }}
    >
      {selectable ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button type="submit" className="btn ghost" disabled={pending} style={{ color: "var(--danger, #c0392b)" }}>
            {pending ? "删除中…" : "删除选中"}
          </button>
        </div>
      ) : null}
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              {selectable ? <th style={{ width: 36 }} /> : null}
              <th>路径 / Key</th>
              <th>类型</th>
              <th>大小</th>
              <th>更新时间</th>
              <th style={{ width: 72 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {selectable ? (
                  <td>
                    <input type="checkbox" name="keys" value={row.key} />
                  </td>
                ) : null}
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
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}

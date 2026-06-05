"use client";

import { useAdminPath } from "@/lib/admin-path-context";
import AdminLink from "@/components/admin-link";
import { useState } from "react";
import type { TgIndexedMessage } from "@/lib/generated/prisma";
import { batchDeleteIndexMessagesAction, deleteIndexMessageAction } from "./actions";

export type IndexListPagination = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  editId?: string;
};

const PAGE_SIZES = [10, 50, 100] as const;

function buildUrl(
  listPath: string,
  opts: {
    edit?: string;
    q?: string;
    page?: number;
    perPage?: number;
    chatIds?: string[];
  }
) {
  const p = new URLSearchParams();
  if (opts.edit) p.set("edit", opts.edit);
  if (opts.q) p.set("q", opts.q);
  for (const id of opts.chatIds ?? []) p.append("chat", id);
  if (opts.page && opts.page > 1) p.set("page", String(opts.page));
  const pp = opts.perPage ?? 10;
  if (pp !== 10) p.set("perPage", String(pp));
  const s = p.toString();
  return s ? `${listPath}?${s}` : listPath;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

const typeLabel: Record<string, string> = {
  VIDEO: "视频",
  PHOTO: "图片",
  DOCUMENT: "文件",
  TEXT: "文本"
};

export default function IndexMessageTable({
  rows,
  listQuery = "",
  selectedChatIds = [],
  pagination
}: {
  rows: TgIndexedMessage[];
  listQuery?: string;
  selectedChatIds?: string[];
  pagination: IndexListPagination;
}) {
  const { total, page, pageSize, totalPages, editId } = pagination;
  const { path } = useAdminPath();
  const listPath = path("/index-messages");
  const previewBase = path("/index-messages/preview");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const url = (opts: Parameters<typeof buildUrl>[1]) => buildUrl(listPath, opts);

  const allOnPage = rows.map((r) => r.id);
  const allChecked = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        for (const id of allOnPage) next.delete(id);
      } else {
        for (const id of allOnPage) next.add(id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <form action={batchDeleteIndexMessagesAction} className="admin-batch-bar">
        {Array.from(selected).map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <button
          type="submit"
          className="btn-admin-ghost danger"
          disabled={selected.size === 0}
          onClick={(e) => {
            if (selected.size === 0) return;
            if (!confirm(`确定删除选中的 ${selected.size} 条索引？`)) e.preventDefault();
          }}
        >
          批量删除{selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="全选本页" />
              </th>
              <th>标题</th>
              <th>类型</th>
              <th>来源</th>
              <th>浏览量</th>
              <th>排序热度</th>
              <th>消息时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "var(--muted)", textAlign: "center", padding: "28px 12px" }}>
                  {listQuery || selectedChatIds.length ? "没有匹配的索引。" : "暂无索引数据，请先运行采集服务。"}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className={row.isPinned ? "admin-post-row-pinned" : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      aria-label={`选择 ${row.title}`}
                    />
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 10px" }}>
                      {row.isPinned ? (
                        <span className="post-pinned-badge" title="首页置顶">
                          👑
                        </span>
                      ) : null}
                      <strong style={{ flex: "1 1 12rem", minWidth: 0 }}>{row.title}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>{row.snippet.slice(0, 80)}…</div>
                  </td>
                  <td>{typeLabel[row.contentType] ?? row.contentType}</td>
                  <td style={{ fontSize: 13 }}>{row.sourceTitle || row.sourceUsername || "—"}</td>
                  <td>{row.views}</td>
                  <td>{row.heat}</td>
                  <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{formatDate(row.messageDate)}</td>
                  <td>
                    <div className="admin-table-actions">
                      <AdminLink
                        className="admin-icon-action"
                        href={`${previewBase}/${row.id}`}
                        title="预览媒体"
                        aria-label="预览媒体"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </AdminLink>
                      <button
                        type="button"
                        className="admin-icon-action"
                        title="编辑"
                        aria-label="编辑"
                        onClick={() => {
                          window.location.assign(
                            url({
                              edit: row.id,
                              q: listQuery || undefined,
                              chatIds: selectedChatIds,
                              page,
                              perPage: pageSize
                            })
                          );
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <form action={deleteIndexMessageAction.bind(null, row.id)}>
                        <button
                          className="admin-icon-action danger"
                          type="submit"
                          aria-label="删除"
                          onClick={(e) => {
                            if (!confirm("确定删除这条索引？")) e.preventDefault();
                          }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-table-pagination">
        <span>
          共 {total} 条{total ? ` · 每页 ${pageSize} 条` : ""}
        </span>
        <div className="admin-pagination-row">
          <div className="admin-per-page" role="group" aria-label="每页条数">
            <span className="admin-per-page-label">每页</span>
            {PAGE_SIZES.map((n) =>
              pageSize === n ? (
                <span key={n} className="admin-per-page-opt is-active" aria-current="true">
                  {n}
                </span>
              ) : (
                <AdminLink
                  key={n}
                  href={url({ edit: editId, q: listQuery || undefined, chatIds: selectedChatIds, perPage: n })}
                  className="admin-per-page-opt"
                >
                  {n}
                </AdminLink>
              )
            )}
          </div>
          <div className="admin-pagination-pages">
            {page > 1 ? (
              <AdminLink
                href={url({
                  edit: editId,
                  q: listQuery || undefined,
                  chatIds: selectedChatIds,
                  page: page - 1,
                  perPage: pageSize
                })}
              >
                上一页
              </AdminLink>
            ) : (
              <span style={{ opacity: 0.4 }}>上一页</span>
            )}
            <span>
              第 {page} / {totalPages} 页
            </span>
            {page < totalPages ? (
              <AdminLink
                href={url({
                  edit: editId,
                  q: listQuery || undefined,
                  chatIds: selectedChatIds,
                  page: page + 1,
                  perPage: pageSize
                })}
              >
                下一页
              </AdminLink>
            ) : (
              <span style={{ opacity: 0.4 }}>下一页</span>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

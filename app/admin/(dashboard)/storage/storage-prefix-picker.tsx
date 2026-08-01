"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adminPath } from "@/lib/admin-path";
import type { StorageSort } from "@/lib/storage-stats-shared";

const PREFIX_OPTIONS: { value: string; label: string }[] = [
  { value: "uploads/", label: "全部 uploads/" },
  { value: "uploads/tg-index/", label: "首页索引 uploads/tg-index/" },
  { value: "uploads/tg-search/", label: "用户搜索 uploads/tg-search/" },
  { value: "uploads/telegram/", label: "Telegram uploads/telegram/" }
];

const SORT_OPTIONS: { value: StorageSort; label: string }[] = [
  { value: "date_desc", label: "时间 · 新→旧" },
  { value: "date_asc", label: "时间 · 旧→新" },
  { value: "size_desc", label: "大小 · 大→小" },
  { value: "size_asc", label: "大小 · 小→大" },
  { value: "key_asc", label: "路径 · A→Z" }
];

const LIMIT_OPTIONS = [200, 500, 1000, 2000, 5000];

export function StorageBrowseControls({
  currentPrefix,
  currentSort,
  currentLimit
}: {
  currentPrefix: string;
  currentSort: StorageSort;
  currentLimit: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [prefix, setPrefix] = useState(currentPrefix);
  const [sort, setSort] = useState<StorageSort>(currentSort);
  const [limit, setLimit] = useState(currentLimit);

  function apply(next: { prefix?: string; sort?: StorageSort; limit?: number; token?: string | null }) {
    const p = (next.prefix ?? prefix).trim() || "uploads/";
    const s = next.sort ?? sort;
    const l = next.limit ?? limit;
    setPrefix(p);
    setSort(s);
    setLimit(l);
    const params = new URLSearchParams();
    params.set("prefix", p);
    params.set("sort", s);
    params.set("limit", String(l));
    if (next.token) params.set("token", next.token);
    startTransition(() => {
      router.push(`${adminPath("/storage")}?${params.toString()}`);
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label htmlFor="storage-prefix" style={{ fontSize: 13, fontWeight: 700 }}>
          分类 / 前缀
        </label>
        <select
          id="storage-prefix"
          value={PREFIX_OPTIONS.some((o) => o.value === prefix) ? prefix : "__custom__"}
          disabled={pending}
          onChange={(e) => {
            if (e.target.value === "__custom__") return;
            apply({ prefix: e.target.value, token: null });
          }}
          style={{ minWidth: 260, padding: "8px 10px", borderRadius: 8 }}
        >
          {PREFIX_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
          {!PREFIX_OPTIONS.some((o) => o.value === prefix) ? (
            <option value="__custom__">自定义：{prefix}</option>
          ) : null}
        </select>
        <input
          type="text"
          value={prefix}
          disabled={pending}
          onChange={(e) => setPrefix(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply({ prefix: prefix.trim() || "uploads/", token: null });
            }
          }}
          placeholder="uploads/tg-index/…"
          style={{ flex: 1, minWidth: 200, padding: "8px 10px", borderRadius: 8 }}
        />
        <button
          type="button"
          className="btn secondary"
          disabled={pending}
          onClick={() => apply({ prefix: prefix.trim() || "uploads/", token: null })}
        >
          查看
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label htmlFor="storage-sort" style={{ fontSize: 13, fontWeight: 700 }}>
          排序
        </label>
        <select
          id="storage-sort"
          value={sort}
          disabled={pending}
          onChange={(e) => apply({ sort: e.target.value as StorageSort, token: null })}
          style={{ minWidth: 160, padding: "8px 10px", borderRadius: 8 }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <label htmlFor="storage-limit" style={{ fontSize: 13, fontWeight: 700 }}>
          每页条数
        </label>
        <select
          id="storage-limit"
          value={limit}
          disabled={pending}
          onChange={(e) => apply({ limit: Number(e.target.value) || 1000, token: null })}
          style={{ minWidth: 100, padding: "8px 10px", borderRadius: 8 }}
        >
          {LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** @deprecated 使用 StorageBrowseControls */
export function StoragePrefixPicker({ currentPrefix }: { currentPrefix: string }) {
  return <StorageBrowseControls currentPrefix={currentPrefix} currentSort="date_desc" currentLimit={1000} />;
}

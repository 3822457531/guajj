"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { HomeChannelOption } from "@/lib/home-feed";

export function H5HomeSearchPanel({
  defaultQuery,
  channels,
  selectedChannelIds
}: {
  defaultQuery: string;
  channels: HomeChannelOption[];
  selectedChannelIds: string[];
}) {
  const [selected, setSelected] = useState<string[]>(selectedChannelIds);

  useEffect(() => {
    setSelected(selectedChannelIds);
  }, [selectedChannelIds]);

  const toggleChannel = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearChannels = () => setSelected([]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("q") ?? "").trim();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    for (const id of selected) params.append("channel", id);
    window.location.href = params.toString() ? `/?${params.toString()}` : "/";
  };

  return (
    <details className="h5-search-details">
      <summary className="h5-search-trigger" aria-label="搜索与类型筛选">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4.2-4.2" />
        </svg>
        {selected.length > 0 ? <span className="h5-search-trigger-badge">{selected.length}</span> : null}
      </summary>

      <form className="h5-search-form h5-search-form--panel" onSubmit={onSubmit}>
        <div className="h5-search-form-row">
          <input
            type="search"
            name="q"
            defaultValue={defaultQuery}
            placeholder="输入关键词搜索标题、正文…"
            className="h5-search-input"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="h5-search-submit">
            搜索
          </button>
        </div>

        {channels.length > 0 ? (
          <div className="h5-search-channels">
            <div className="h5-search-channels-head">
              <span className="h5-search-channels-title">类型筛选</span>
              <button type="button" className="h5-search-channels-clear" onClick={clearChannels} disabled={selected.length === 0}>
                清空
              </button>
            </div>
            <div className="h5-search-channel-list" role="group" aria-label="选择类型">
              {channels.map((ch) => {
                const checked = selected.includes(ch.id);
                return (
                  <label key={ch.id} className={`h5-search-channel-item${checked ? " is-checked" : ""}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleChannel(ch.id)}
                    />
                    <span className="h5-search-channel-label" title={ch.label}>
                      {ch.label}
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="h5-search-channels-hint">可多选或单选，不选则搜索全部类型</p>
          </div>
        ) : (
          <p className="h5-search-channels-empty">暂无类型数据</p>
        )}
      </form>
    </details>
  );
}

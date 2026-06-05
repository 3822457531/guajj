"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageMediaGallery } from "@/components/tg-search-test-media";
import type { ChannelMessageItem, JisouChannelItem } from "@/lib/jisou-search-types";

type JisouChannel = JisouChannelItem;

export default function TgSearchTestPage() {
  const [query, setQuery] = useState("美腿丝袜");
  const [channelSearch, setChannelSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<JisouChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<JisouChannel | null>(null);
  const [channelMeta, setChannelMeta] = useState<{
    entityType?: string;
    broadcast?: boolean | null;
    note?: string;
    rawCount?: number;
    anchorMessageId?: number | null;
  } | null>(null);
  const [messages, setMessages] = useState<ChannelMessageItem[]>([]);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const anchorRef = useRef<HTMLLIElement>(null);

  const pushLog = useCallback((message: string, extra?: Record<string, unknown>) => {
    const line = `[${new Date().toLocaleTimeString("zh-CN", { hour12: false })}] ${message}${
      extra ? ` ${JSON.stringify(extra)}` : ""
    }`;
    console.log("[tg-search:page]", message, extra ?? "");
    setDebugLogs((prev) => [line, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    pushLog("页面已 hydrate，客户端 JS 正常");
  }, [pushLog]);

  useEffect(() => {
    if (channelLoading || !messages.some((m) => m.isAnchor)) return;
    const t = window.setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [messages, channelLoading]);

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) {
      pushLog("关键词为空，跳过搜索");
      return;
    }

    pushLog("开始极搜", { q });
    setLoading(true);
    setError(null);
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);
    setChannelMeta(null);

    try {
      const url = "/api/test/tg-search/search";
      pushLog("fetch POST", { url, q });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      pushLog("收到响应", { status: res.status, ok: res.ok });
      let data: { ok?: boolean; message?: string; error?: string; channels?: JisouChannel[] };
      try {
        data = await res.json();
      } catch {
        pushLog("JSON 解析失败", { status: res.status });
        throw new Error(res.ok ? "搜索响应解析失败" : `搜索请求失败 (HTTP ${res.status})`);
      }
      pushLog("响应体", {
        ok: data.ok,
        error: data.error,
        channels: data.channels?.length ?? 0
      });
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || `搜索失败 (HTTP ${res.status})`);
      }
      setChannels(data.channels || []);
      if (!data.channels?.length) {
        setError("极搜未返回频道链接（可能无匹配或超时）");
        pushLog("极搜返回 0 个频道");
      } else {
        pushLog("极搜完成", { count: data.channels.length });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "搜索失败";
      pushLog("搜索异常", { message: msg });
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannel(channel: JisouChannel, inChannelSearch?: string) {
    if (!channel.username) {
      setError("该结果为邀请链接频道，本测试页暂只支持 @username 公开频道");
      return;
    }

    setActiveChannel(channel);
    setChannelLoading(true);
    setError(null);
    setMessages([]);
    setChannelMeta(null);

    try {
      const params = new URLSearchParams({
        username: channel.username,
        limit: "20"
      });
      const kw = (inChannelSearch ?? channelSearch).trim();
      if (kw) {
        params.set("search", kw);
      } else if (channel.postId) {
        params.set("messageId", String(channel.postId));
        pushLog("极搜定位消息", { postId: channel.postId });
      }

      const url = `/api/test/tg-search/channel?${params.toString()}`;
      pushLog("fetch GET 频道", { url });
      const res = await fetch(url);
      pushLog("频道响应", { status: res.status, ok: res.ok });
      let data: {
        ok?: boolean;
        message?: string;
        error?: string;
        entityType?: string;
        broadcast?: boolean | null;
        note?: string;
        rawCount?: number;
        anchorMessageId?: number | null;
        messages?: ChannelMessageItem[];
      };
      try {
        data = await res.json();
      } catch {
        throw new Error(res.ok ? "频道响应解析失败" : `读取频道失败 (HTTP ${res.status})`);
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || `读取频道失败 (HTTP ${res.status})`);
      }
      setChannelMeta({
        entityType: data.entityType,
        broadcast: data.broadcast,
        note: data.note,
        rawCount: data.rawCount,
        anchorMessageId: data.anchorMessageId
      });
      setMessages(data.messages || []);
      if (!data.messages?.length) {
        setError("频道可读，但当前条件下没有消息（试试清空频道内搜索或换频道）");
      }
      pushLog("频道消息", {
        count: data.messages?.length ?? 0,
        anchor: data.anchorMessageId ?? null
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "读取频道失败";
      pushLog("频道异常", { message: msg });
      setError(msg);
    } finally {
      setChannelLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 48px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>TG 搜索联调测试页</h1>
      <p style={{ margin: "0 0 20px", color: "#555", lineHeight: 1.6, fontSize: 14 }}>
        流程：极搜关键词 → 解析频道链接 → 点击频道 → <strong>自动定位极搜返回的那条消息</strong>（与 TG 一致，非最新列表）。
        相册合并展示；封面缩略图预缓存 R2，其余按需加载。
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
        style={{ display: "flex", gap: 8, marginBottom: 16 }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索关键词，如 美腿丝袜"
          style={{ flex: 1, padding: "10px 12px", fontSize: 15, border: "1px solid #ccc", borderRadius: 8 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onSearch();
            }
          }}
        />
        <button
          type="button"
          onClick={() => void onSearch()}
          disabled={loading}
          style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "#111", color: "#fff", fontWeight: 700 }}
        >
          {loading ? "极搜中…" : "① 极搜搜索"}
        </button>
      </form>

      {error ? (
        <p style={{ color: "#b91c1c", background: "#fef2f2", padding: 12, borderRadius: 8, fontSize: 14 }}>{error}</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 16, alignItems: "start" }}>
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>② 频道列表 ({channels.length})</h2>
          {channels.length === 0 ? (
            <p style={{ color: "#888", fontSize: 14 }}>搜索后显示极搜返回的频道链接</p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {channels.map((ch) => {
                const active = activeChannel?.url === ch.url;
                return (
                  <li key={ch.url}>
                    <button
                      type="button"
                      onClick={() => loadChannel(ch)}
                      disabled={channelLoading}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: active ? "2px solid #2563eb" : "1px solid #e5e7eb",
                        background: active ? "#eff6ff" : "#fff",
                        cursor: "pointer"
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{ch.title}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                        @{ch.username || "—"}
                        {ch.postId ? (
                          <span style={{ color: "#2563eb", fontWeight: 600 }}> · 📍 #{ch.postId}</span>
                        ) : null}
                        {ch.members ? ` · ${ch.members}` : ""}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 12, minHeight: 320 }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>③ 频道消息</h2>

          {activeChannel ? (
            <>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#444" }}>
                当前：<strong>@{activeChannel.username}</strong>
                {channelMeta?.entityType ? ` · ${channelMeta.entityType}` : ""}
                {channelMeta?.broadcast === true ? " · 公开广播频道" : ""}
                {channelMeta?.anchorMessageId ? (
                  <span style={{ color: "#2563eb", fontWeight: 600 }}> · 极搜定位 #{channelMeta.anchorMessageId}</span>
                ) : null}
                {channelMeta?.rawCount != null ? ` · 原始 ${channelMeta.rawCount} 条 / 展示 ${messages.length} 组` : ""}
              </p>
              {channelMeta?.note ? (
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#666", background: "#f9fafb", padding: 8, borderRadius: 6 }}>
                  {channelMeta.note}
                </p>
              ) : null}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (activeChannel) loadChannel(activeChannel, channelSearch);
                }}
                style={{ display: "flex", gap: 8, marginBottom: 12 }}
              >
                <input
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="频道内搜索（可选，对应 TG 频道内搜索）"
                  style={{ flex: "1", padding: "8px 10px", fontSize: 14, border: "1px solid #ddd", borderRadius: 6 }}
                />
                <button type="submit" disabled={channelLoading} style={{ padding: "8px 12px", borderRadius: 6 }}>
                  {channelLoading ? "加载中…" : "刷新"}
                </button>
              </form>
            </>
          ) : (
            <p style={{ color: "#888", fontSize: 14 }}>点击左侧频道，测试是否无需 join 即可读消息</p>
          )}

          {channelLoading ? (
            <p style={{ fontSize: 14 }}>正在拉取消息并预缓存封面缩略图（相册仅首张）…</p>
          ) : null}

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {messages.map((msg) => (
              <li
                key={`${msg.kind}-${msg.id}`}
                ref={msg.isAnchor ? anchorRef : undefined}
                style={{
                  border: msg.isAnchor ? "2px solid #2563eb" : "1px solid #eee",
                  borderRadius: 8,
                  padding: 10,
                  background: msg.isAnchor ? "#eff6ff" : "#fff",
                  boxShadow: msg.isAnchor ? "0 0 0 1px #93c5fd" : undefined
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: "#666" }}>
                  <span>
                    {msg.isAnchor ? (
                      <strong style={{ color: "#2563eb", marginRight: 6 }}>极搜定位</strong>
                    ) : null}
                    {msg.kind === "album" ? `相册 #${msg.ids.join(",")}` : `#${msg.id}`} · {msg.contentType}
                    {msg.albumSize > 1 ? ` · ${msg.albumSize} 项` : ""}
                  </span>
                  <a href={msg.permalink} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                    在 TG 打开
                  </a>
                </div>

                {activeChannel?.username && msg.mediaItems.length > 0 ? (
                  <MessageMediaGallery username={activeChannel.username} msg={msg} />
                ) : null}

                <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {msg.textPreview}
                </p>
                {msg.date ? (
                  <time style={{ fontSize: 11, color: "#999" }} dateTime={msg.date}>
                    {new Date(msg.date).toLocaleString("zh-CN")}
                  </time>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section style={{ marginTop: 20, border: "1px solid #e5e7eb", borderRadius: 10, padding: 12 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 14, color: "#374151" }}>
          调试日志（页面 + 服务端请 grep <code style={{ fontSize: 12 }}>[tg-search:</code>）
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280" }}>
          若点击搜索后 URL 变成 <code>/test/tg-search?</code> 且此处无日志，说明客户端 JS 未加载；若页面有日志但服务端无，说明请求未到达 API。
        </p>
        {debugLogs.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>暂无日志，点击搜索后会显示</p>
        ) : (
          <pre
            style={{
              margin: 0,
              maxHeight: 220,
              overflow: "auto",
              fontSize: 11,
              lineHeight: 1.5,
              background: "#111827",
              color: "#e5e7eb",
              padding: 10,
              borderRadius: 6,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all"
            }}
          >
            {debugLogs.join("\n")}
          </pre>
        )}
      </section>
    </main>
  );
}

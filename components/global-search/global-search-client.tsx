"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageMediaGallery } from "@/components/tg-search-media";
import { TG_SEARCH_API } from "@/lib/tg-search-api-paths";
import type { ChannelMessageItem, JisouCaptchaChallenge, JisouChannelItem } from "@/lib/jisou-search-types";

const API = TG_SEARCH_API.prod;

type JisouChannel = JisouChannelItem;

function formatMembers(raw: string | null | undefined) {
  if (!raw) return null;
  return raw.replace(/\s+/g, " ").trim();
}

export function GlobalSearchClient() {
  const [query, setQuery] = useState("");
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
  const [captcha, setCaptcha] = useState<JisouCaptchaChallenge | null>(null);
  const [captchaSubmitting, setCaptchaSubmitting] = useState(false);
  const [mobileDetail, setMobileDetail] = useState(false);
  const anchorRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (channelLoading || !messages.some((m) => m.isAnchor)) return;
    const t = window.setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [messages, channelLoading]);

  function applySearchSuccess(data: { channels?: JisouChannel[] }) {
    setCaptcha(null);
    setChannels(data.channels || []);
    setActiveChannel(null);
    setMessages([]);
    setChannelMeta(null);
    setMobileDetail(false);
    if (!data.channels?.length) {
      setError("未找到相关频道，请换个关键词试试");
    } else {
      setError(null);
    }
  }

  async function submitCaptchaAnswer(answer: string) {
    if (!captcha) return;
    setCaptchaSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API}/captcha/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: captcha.challengeId, answer }),
        signal: AbortSignal.timeout(115000)
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        channels?: JisouChannel[];
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        setCaptcha(data.captcha);
        setError(data.message || "答案错误，请根据新题目重试");
        return;
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "验证失败");
      }

      applySearchSuccess(data);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "TimeoutError"
          ? "验证超时，请稍后重试"
          : err instanceof Error
            ? err.message
            : "验证失败";
      setError(msg);
    } finally {
      setCaptchaSubmitting(false);
    }
  }

  async function onSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setError(null);
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);
    setChannelMeta(null);
    setCaptcha(null);
    setMobileDetail(false);

    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
        signal: AbortSignal.timeout(55000)
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        channels?: JisouChannel[];
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        setCaptcha(data.captcha);
        setError(null);
        return;
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "搜索失败");
      }

      applySearchSuccess(data);
    } catch (err) {
      const msg =
        err instanceof Error && err.name === "TimeoutError"
          ? "搜索超时，请稍后重试"
          : err instanceof Error
            ? err.message
            : "搜索失败";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function loadChannel(channel: JisouChannel, inChannelSearch?: string) {
    if (!channel.username) {
      setError("该结果为邀请链接频道，暂仅支持 @username 公开频道");
      return;
    }

    setActiveChannel(channel);
    setChannelLoading(true);
    setError(null);
    setMessages([]);
    setChannelMeta(null);
    setMobileDetail(true);

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
      }

      const res = await fetch(`${API}/channel?${params.toString()}`);
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        entityType?: string;
        broadcast?: boolean;
        note?: string;
        rawCount?: number;
        anchorMessageId?: number | null;
        messages?: ChannelMessageItem[];
      };

      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "读取频道失败");
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
        setError("频道可读，但当前条件下没有消息");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "读取频道失败");
    } finally {
      setChannelLoading(false);
    }
  }

  const hasResults = channels.length > 0 || Boolean(activeChannel) || loading;

  return (
    <div className="global-search-body">
      <form
        className="vip-search-bar global-search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          void onSearch();
        }}
      >
        <div className="vip-search-field">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索暗网频道、关键词…"
            className="h5-search-input vip-search-input"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <button type="submit" className="h5-search-submit vip-search-submit" disabled={loading}>
          {loading ? "搜索中" : "搜索"}
        </button>
      </form>

      {captcha ? (
        <section className="gs-captcha" key={captcha.challengeId}>
          <div className="gs-captcha-head">
            <span className="gs-captcha-badge">人机验证</span>
            <p className="gs-captcha-hint">完成验证后即可继续全网搜索</p>
          </div>
          {error ? <p className="gs-alert gs-alert--inline">{error}</p> : null}
          <p className="gs-captcha-prompt">{captcha.prompt}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={captcha.challengeId}
            src={`${captcha.imageUrl}?v=${encodeURIComponent(captcha.challengeId)}`}
            alt="验证码算式"
            className="gs-captcha-img"
          />
          <div className="gs-captcha-options">
            {captcha.options.map((opt) => (
              <button
                key={`${captcha.challengeId}-${opt}`}
                type="button"
                className="gs-captcha-opt"
                disabled={captchaSubmitting}
                onClick={() => void submitCaptchaAnswer(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
          {captchaSubmitting ? <p className="gs-captcha-wait">正在验证并继续搜索…</p> : null}
        </section>
      ) : null}

      {error && !captcha && !channelLoading ? <p className="gs-alert">{error}</p> : null}

      {!hasResults && !captcha && !loading ? (
        <section className="gs-empty-intro">
          <div className="gs-empty-icon" aria-hidden>
            🌐
          </div>
          <h2 className="gs-empty-title">搜索暗网全网频道</h2>
          <p className="gs-empty-desc">
            通过暗网索引检索公开频道与群组，点击结果可预览消息与媒体，无需安装任何客户端。
          </p>
          <ul className="gs-empty-tips">
            <li>支持定位到索引返回的具体帖子</li>
            <li>图片封面预缓存，视频点击后播放</li>
            <li>遇验证码时在网页完成即可</li>
          </ul>
        </section>
      ) : null}

      {hasResults ? (
        <div
          className={`gs-panels${mobileDetail && activeChannel ? " gs-panels--detail" : ""}`}
        >
          <section className="gs-panel gs-panel--channels" aria-label="暗网结果列表">
            <div className="gs-panel-head">
              <h2 className="gs-panel-title">暗网结果</h2>
              <span className="gs-panel-count">{channels.length}</span>
            </div>

            {loading ? (
              <p className="gs-panel-loading">正在全网检索…</p>
            ) : channels.length === 0 ? (
              <p className="gs-panel-muted">暂无频道</p>
            ) : (
              <ul className="gs-channel-list">
                {channels.map((ch) => {
                  const active = activeChannel?.url === ch.url;
                  const members = formatMembers(ch.members);
                  return (
                    <li key={ch.url}>
                      <button
                        type="button"
                        className={`gs-channel-card${active ? " is-active" : ""}`}
                        onClick={() => void loadChannel(ch)}
                        disabled={channelLoading}
                      >
                        <div className="gs-channel-card-main">
                          <span className="gs-channel-title">{ch.title}</span>
                          {ch.label ? <span className="gs-channel-label">{ch.label}</span> : null}
                        </div>
                        <div className="gs-channel-meta">
                          @{ch.username || "—"}
                          {ch.postId ? <span className="gs-channel-post"> · #{ch.postId}</span> : null}
                          {members ? <span> · {members}</span> : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="gs-panel gs-panel--messages" aria-label="频道消息">
            {mobileDetail && activeChannel ? (
              <button
                type="button"
                className="gs-mobile-back"
                onClick={() => setMobileDetail(false)}
              >
                ← 返回暗网列表
              </button>
            ) : null}

            {!activeChannel ? (
              <div className="gs-panel-placeholder">
                <p>选择左侧频道查看消息预览</p>
              </div>
            ) : (
              <>
                <div className="gs-panel-head gs-panel-head--stack">
                  <h2 className="gs-panel-title">@{activeChannel.username}</h2>
                  <p className="gs-channel-submeta">
                    {channelMeta?.entityType ? `${channelMeta.entityType}` : "频道"}
                    {channelMeta?.broadcast ? " · 公开广播" : ""}
                    {channelMeta?.anchorMessageId ? (
                      <span className="gs-channel-post"> · 定位 #{channelMeta.anchorMessageId}</span>
                    ) : null}
                  </p>
                </div>

                {channelMeta?.note ? <p className="gs-panel-note">{channelMeta.note}</p> : null}

                <form
                  className="gs-inline-search"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (activeChannel) void loadChannel(activeChannel, channelSearch);
                  }}
                >
                  <input
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    placeholder="频道内搜索（可选）"
                    className="gs-inline-search-input"
                  />
                  <button type="submit" className="gs-inline-search-btn" disabled={channelLoading}>
                    {channelLoading ? "…" : "刷新"}
                  </button>
                </form>

                {channelLoading ? (
                  <p className="gs-panel-loading">正在加载消息并并发预缓存封面…</p>
                ) : (
                  <ul className="gs-message-list">
                    {messages.map((msg) => (
                      <li
                        key={`${msg.kind}-${msg.id}`}
                        ref={msg.isAnchor ? anchorRef : undefined}
                        className={`gs-message-card${msg.isAnchor ? " is-anchor" : ""}`}
                      >
                        <div className="gs-message-head">
                          <span>
                            {msg.isAnchor ? <strong className="gs-anchor-tag">定位</strong> : null}
                            {msg.kind === "album" ? `相册 · ${msg.albumSize} 张` : `#${msg.id}`}
                            {" · "}
                            {msg.contentType}
                          </span>
                          <Link
                            href={msg.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gs-message-tg-link"
                          >
                            查看原文
                          </Link>
                        </div>

                        {activeChannel.username && msg.mediaItems.length > 0 ? (
                          <MessageMediaGallery username={activeChannel.username} msg={msg} />
                        ) : null}

                        {msg.textPreview ? (
                          <p className="gs-message-text">{msg.textPreview}</p>
                        ) : null}

                        {msg.date ? (
                          <time className="gs-message-time" dateTime={msg.date}>
                            {new Date(msg.date).toLocaleString("zh-CN")}
                          </time>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

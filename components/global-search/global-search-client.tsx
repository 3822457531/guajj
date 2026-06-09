"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageMediaGallery } from "@/components/tg-search-media";
import {
  collectChannelThumbIds,
  collectChannelVideoIds,
  mergeChannelThumbMap,
  type ChannelThumbMap
} from "@/lib/channel-media-batch";
import { TG_SEARCH_API, TG_SEARCH_HISTORY_API, TG_SEARCH_QUOTA_API } from "@/lib/tg-search-api-paths";
import {
  isJisouPromotedChannel,
  type ChannelMessageItem,
  type JisouCaptchaChallenge,
  type JisouChannelItem
} from "@/lib/jisou-search-types";
import {
  isSupportedJisouFilterCallback,
  normalizeJisouSearchButtons,
  parseJisouCallbackFilterType,
  pickSupportedJisouFilterButtons,
  formatJisouChannelRow,
  jisouFilterButtonLabel,
  jisouFilterButtonTitle,
  type JisouButtonItem,
  type JisouSearchButtons
} from "@/lib/jisou-search-buttons";

const API = TG_SEARCH_API.prod;

type JisouChannel = JisouChannelItem;

type QuotaState = {
  used: number;
  limit: number;
  remaining: number;
  searchBonus: number;
  hasIdentity: boolean;
  publicId: string | null;
  dailyBaseLimit: number;
};

type HistoryKeyword = {
  keyword: string;
  searchedAt: string | null;
};

const HISTORY_COLLAPSED = 8;

type SearchSuccessPayload = {
  channels?: JisouChannel[];
  quota?: QuotaState;
  cached?: boolean;
  buttons?: unknown;
  replyMessageId?: number;
  query?: string;
};

function JisouSearchToolbar({
  buttons,
  activeFilterCallback,
  disabled,
  loading,
  onAction
}: {
  buttons: JisouSearchButtons;
  activeFilterCallback: string | null;
  disabled?: boolean;
  loading?: boolean;
  onAction: (button: JisouButtonItem) => void;
}) {
  const visibleFilters = pickSupportedJisouFilterButtons(buttons.filters);
  if (!visibleFilters.length && !buttons.actions.length) return null;

  return (
    <div className="gs-jisou-toolbar" aria-label="极搜筛选与翻页">
      {visibleFilters.length > 0 ? (
        <div className="gs-jisou-row gs-jisou-row--filters" role="toolbar" aria-label="结果类型筛选">
          {visibleFilters.map((btn) => {
            const active = Boolean(btn.callback && btn.callback === activeFilterCallback);
            return (
              <button
                key={`filter-${btn.callback || btn.text}`}
                type="button"
                className={`gs-jisou-btn gs-jisou-btn--filter${active ? " is-active" : ""}`}
                disabled={disabled || loading || !btn.callback}
                title={jisouFilterButtonTitle(btn)}
                aria-pressed={active}
                onClick={() => onAction(btn)}
              >
                {jisouFilterButtonLabel(btn)}
              </button>
            );
          })}
        </div>
      ) : null}
      {buttons.actions.length > 0 ? (
        <div className="gs-jisou-row gs-jisou-row--actions" role="toolbar" aria-label="结果操作">
          {buttons.actions.map((btn) => (
            <button
              key={`action-${btn.callback || btn.text}`}
              type="button"
              className="gs-jisou-btn gs-jisou-btn--action"
              disabled={disabled || loading || !btn.callback}
              onClick={() => onAction(btn)}
            >
              {btn.text}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChannelResourcesLoading() {
  const steps = ["正在连接暗网索引…", "正在拉取频道消息…", "正在预缓存封面与视频…"];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStep((current) => (current + 1) % steps.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [steps.length]);

  return (
    <div className="gs-resources-loading" aria-busy="true" aria-live="polite">
      <div className="gs-resources-loading-orbit" aria-hidden>
        <span className="gs-resources-loading-globe">🌐</span>
        <span className="gs-resources-loading-ring" />
      </div>
      <p className="gs-resources-loading-title">拉取全网资源中</p>
      <p className="gs-resources-loading-step">{steps[step]}</p>
      <div className="gs-resources-loading-dots" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="gs-resources-loading-skeletons" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="gs-resources-loading-card" style={{ animationDelay: `${i * 120}ms` }}>
            <div className="gs-resources-loading-line gs-resources-loading-line--short" />
            <div className="gs-resources-loading-line" />
            <div className="gs-resources-loading-thumb" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SensitiveContentMosaic({ text }: { text?: string | null }) {
  return (
    <div className="gs-sensitive-mosaic" aria-label="平台已屏蔽敏感内容">
      {text ? <span className="gs-sensitive-mosaic-text">{text}</span> : null}
      <span className="gs-sensitive-mosaic-badge">平台已屏蔽敏感内容</span>
    </div>
  );
}

function ChannelMessagesModal({
  channel,
  activeFilterType,
  channelMeta,
  channelSearch,
  onChannelSearchChange,
  onReload,
  messages,
  channelLoading,
  loadError,
  onClose,
  onOpenArticle,
  anchorRef
}: {
  channel: JisouChannel;
  activeFilterType: string | null;
  channelMeta: {
    entityType?: string;
    broadcast?: boolean | null;
    note?: string;
    rawCount?: number;
    anchorMessageId?: number | null;
  } | null;
  channelSearch: string;
  onChannelSearchChange: (value: string) => void;
  onReload: () => void;
  messages: ChannelMessageItem[];
  channelLoading: boolean;
  loadError: string | null;
  onClose: () => void;
  onOpenArticle: (payload: { title: string; text: string }) => void;
  anchorRef: React.RefObject<HTMLLIElement | null>;
}) {
  const { icon: headerIcon, title: headerTitle } = formatJisouChannelRow(channel, activeFilterType);
  const messageIcon = formatJisouChannelRow(channel, activeFilterType).icon;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="gs-channel-sheet" role="dialog" aria-modal="true" aria-label="频道消息">
      <button type="button" className="gs-channel-sheet-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="gs-channel-sheet-panel">
        <div className="gs-channel-sheet-head">
          <h3 className="gs-channel-sheet-title">
            {headerIcon ? (
              <span className="gs-result-type-icon" aria-hidden>
                {headerIcon}
              </span>
            ) : null}
            {headerTitle || channel.title}
          </h3>
          <button type="button" className="gs-channel-sheet-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        {channelMeta?.note ? <p className="gs-panel-note">{channelMeta.note}</p> : null}
        {channelMeta?.anchorMessageId ? (
          <p className="gs-channel-sheet-meta">已定位到消息 #{channelMeta.anchorMessageId}</p>
        ) : null}

        {!channelLoading || messages.length > 0 ? (
          <form
            className="gs-inline-search"
            onSubmit={(e) => {
              e.preventDefault();
              onReload();
            }}
          >
            <input
              value={channelSearch}
              onChange={(e) => onChannelSearchChange(e.target.value)}
              placeholder="频道内搜索（可选）"
              className="gs-inline-search-input"
            />
            <button type="submit" className="gs-inline-search-btn" disabled={channelLoading}>
              {channelLoading ? "…" : "刷新"}
            </button>
          </form>
        ) : null}

        <div className="gs-channel-sheet-body">
          {loadError && !channelLoading ? <p className="gs-alert gs-alert--inline">{loadError}</p> : null}
          {channelLoading && messages.length === 0 ? (
            <ChannelResourcesLoading />
          ) : channelLoading ? (
            <p className="gs-panel-loading">正在刷新…</p>
          ) : (
            <ul className="gs-message-list">
              {messages.map((msg) => {
                const fullText = msg.fullText || msg.caption || msg.textPreview || "";
                const articleTitle =
                  msg.kind === "album" ? `相册 · ${msg.albumSize} 张` : `#${msg.id} · ${msg.contentType}`;
                const isSensitive = Boolean(msg.sensitiveBlocked);
                return (
                  <li
                    key={`${msg.kind}-${msg.id}`}
                    ref={msg.isAnchor ? anchorRef : undefined}
                    className={`gs-message-card${msg.isAnchor ? " is-anchor" : ""}${isSensitive ? " gs-message-card--sensitive" : ""}`}
                  >
                    <div className="gs-message-head">
                      <span>
                        {msg.isAnchor ? <strong className="gs-anchor-tag">定位</strong> : null}
                        {msg.kind === "album" ? `相册 · ${msg.albumSize} 张` : `#${msg.id}`}
                        {" · "}
                        {msg.contentType}
                      </span>
                      {!isSensitive && fullText ? (
                        <button
                          type="button"
                          className="gs-message-tg-link gs-message-view-btn"
                          onClick={() => onOpenArticle({ title: articleTitle, text: fullText })}
                        >
                          查看原文
                        </button>
                      ) : !isSensitive && msg.permalink ? (
                        <Link
                          href={msg.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gs-message-tg-link"
                        >
                          查看原文
                        </Link>
                      ) : isSensitive ? (
                        <span className="gs-sensitive-head-badge">已屏蔽</span>
                      ) : null}
                    </div>

                    {isSensitive ? (
                      <>
                        {msg.mediaItems.length > 0 ? (
                          <div className="gs-sensitive-media-placeholder" aria-hidden>
                            <span className="gs-sensitive-mosaic-badge">平台已屏蔽敏感内容</span>
                          </div>
                        ) : null}
                        {msg.textPreview ? <SensitiveContentMosaic text={msg.textPreview} /> : null}
                      </>
                    ) : (
                      <>
                        {channel.username && msg.mediaItems.length > 0 ? (
                          <MessageMediaGallery username={channel.username} msg={msg} />
                        ) : null}

                        {msg.textPreview ? (
                          <p className="gs-message-text">
                            {messageIcon ? (
                              <span className="gs-result-type-icon" aria-hidden>
                                {messageIcon}
                              </span>
                            ) : null}
                            {msg.textPreview}
                          </p>
                        ) : null}
                      </>
                    )}

                    {msg.date ? (
                      <time className="gs-message-time" dateTime={msg.date}>
                        {new Date(msg.date).toLocaleString("zh-CN")}
                      </time>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeChannelText(value: string) {
  return value.replace(/^📢\s*/u, "").replace(/\s+/g, " ").trim();
}

/** 极搜 label 常与 title 重复且很长，仅保留短且不同的 badge */
function shouldShowChannelLabel(title: string, label?: string | null) {
  if (!label) return false;
  const a = normalizeChannelText(title);
  const b = normalizeChannelText(label);
  if (!b || a === b) return false;
  if (a.includes(b) || b.includes(a)) return false;
  return b.length <= 20;
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  pending
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onCancel, pending]);

  return (
    <div className="gs-article-modal" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="gs-article-modal-backdrop"
        onClick={onCancel}
        disabled={pending}
        aria-label="关闭"
      />
      <div className="gs-article-modal-panel gs-confirm-panel">
        <div className="gs-article-modal-head">
          <h3 className="gs-article-modal-title">{title}</h3>
          <button type="button" className="gs-article-modal-close" onClick={onCancel} disabled={pending} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="gs-article-modal-body">
          <p className="gs-confirm-text">{message}</p>
          <div className="gs-confirm-actions">
            <button type="button" className="gs-confirm-btn gs-confirm-btn--ghost" onClick={onCancel} disabled={pending}>
              取消
            </button>
            <button type="button" className="gs-confirm-btn gs-confirm-btn--danger" onClick={onConfirm} disabled={pending}>
              {pending ? "处理中…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdBlockedModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="gs-article-modal" role="dialog" aria-modal="true" aria-label="广告已屏蔽">
      <button type="button" className="gs-article-modal-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="gs-article-modal-panel gs-ad-blocked-panel">
        <div className="gs-article-modal-head">
          <h3 className="gs-article-modal-title">提示</h3>
          <button type="button" className="gs-article-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="gs-article-modal-body">
          <p className="gs-ad-blocked-text">广告内容，已自动屏蔽</p>
        </div>
      </div>
    </div>
  );
}

function ArticleModal({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="gs-article-modal" role="dialog" aria-modal="true" aria-label="查看原文">
      <button type="button" className="gs-article-modal-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="gs-article-modal-panel">
        <div className="gs-article-modal-head">
          <h3 className="gs-article-modal-title">{title}</h3>
          <button type="button" className="gs-article-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="gs-article-modal-body">
          {text.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="gs-article-modal-p">
              {para.split("\n").map((line, j, arr) => (
                <span key={j}>
                  {line}
                  {j < arr.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GlobalSearchClient({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
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
  const [channelLoadError, setChannelLoadError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [history, setHistory] = useState<HistoryKeyword[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [article, setArticle] = useState<{ title: string; text: string } | null>(null);
  const [adBlockedOpen, setAdBlockedOpen] = useState(false);
  const [historyClearConfirmOpen, setHistoryClearConfirmOpen] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [replyMessageId, setReplyMessageId] = useState<number | null>(null);
  const [searchButtons, setSearchButtons] = useState<JisouSearchButtons>({ filters: [], actions: [] });
  const [activeFilterCallback, setActiveFilterCallback] = useState<string | null>(null);
  const [pendingFilterCallback, setPendingFilterCallback] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const anchorRef = useRef<HTMLLIElement>(null);
  const channelAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  function abortChannelWork() {
    channelAbortRef.current?.abort();
    channelAbortRef.current = null;
    setActiveChannel(null);
    setMessages([]);
    setChannelMeta(null);
    setChannelLoadError(null);
    setChannelSearch("");
  }

  function beginSearchSession() {
    abortChannelWork();
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 55000);
    return { controller, clearTimeout: () => window.clearTimeout(timeout) };
  }

  const activeFilterType = parseJisouCallbackFilterType(activeFilterCallback);
  const toolbarEnabled = !fromCache && replyMessageId != null && !loading;

  const refreshQuota = useCallback(async () => {
    try {
      const res = await fetch(TG_SEARCH_QUOTA_API, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; quota?: QuotaState };
      if (data.ok && data.quota) setQuota(data.quota);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(TG_SEARCH_HISTORY_API, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; keywords?: HistoryKeyword[] };
      if (data.ok && data.keywords) setHistory(data.keywords);
    } catch {
      /* ignore */
    }
  }, []);

  const clearSearchHistory = useCallback(async () => {
    setHistoryClearing(true);
    try {
      const res = await fetch(TG_SEARCH_HISTORY_API, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (res.ok) {
        setHistory([]);
        setHistoryExpanded(false);
        setHistoryClearConfirmOpen(false);
      }
    } catch {
      /* ignore */
    } finally {
      setHistoryClearing(false);
    }
  }, []);

  useEffect(() => {
    void refreshQuota();
    void refreshHistory();
  }, [refreshQuota, refreshHistory]);

  useEffect(() => {
    if (channelLoading || !messages.some((m) => m.isAnchor)) return;
    const t = window.setTimeout(() => {
      anchorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [messages, channelLoading]);

  function applyQuotaFromResponse(data: { quota?: QuotaState }) {
    if (data.quota) setQuota(data.quota);
  }

  function applySearchSuccess(data: SearchSuccessPayload, opts?: { freshKeyword?: boolean }) {
    setCaptcha(null);
    setChannels(data.channels || []);
    setActiveChannel(null);
    setMessages([]);
    setChannelMeta(null);
    setChannelLoadError(null);
    setSearchButtons(normalizeJisouSearchButtons(data.buttons));
    if (data.replyMessageId != null) setReplyMessageId(data.replyMessageId);
    if (data.query) setSearchQuery(data.query);

    if (opts?.freshKeyword) {
      setFromCache(Boolean(data.cached));
      setActiveFilterCallback(null);
      setPendingFilterCallback(null);
      applyQuotaFromResponse(data);
      void refreshHistory();
    } else if (pendingFilterCallback) {
      setActiveFilterCallback(pendingFilterCallback);
      setPendingFilterCallback(null);
    }

    if (!opts?.freshKeyword && data.quota) applyQuotaFromResponse(data);

    if (!data.channels?.length) {
      setError("未找到相关频道，请换个关键词试试");
    } else {
      setError(null);
    }
  }

  function handleSearchError(res: Response, data: { message?: string; error?: string; quota?: QuotaState }) {
    applyQuotaFromResponse(data);
    if (data.error === "SEARCH_QUOTA_EXCEEDED" || data.error === "GUEST_IDENTITY_REQUIRED") {
      setError(data.message || "今日搜索额度已用完");
      return true;
    }
    if (!res.ok || !data) {
      throw new Error(data.message || data.error || "搜索失败");
    }
    return false;
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
      const data = (await res.json()) as SearchSuccessPayload & {
        ok?: boolean;
        message?: string;
        error?: string;
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        setCaptcha(data.captcha);
        setError(data.message || "答案错误，请根据新题目重试");
        return;
      }

      if (handleSearchError(res, data)) return;
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "验证失败");
      }

      applySearchSuccess(data);
    } catch (err) {
      setPendingFilterCallback(null);
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

    const { controller: searchAbort, clearTimeout: clearSearchTimeout } = beginSearchSession();

    setLoading(true);
    setError(null);
    setChannels([]);
    setCaptcha(null);
    setFromCache(false);
    setActiveFilterCallback(null);
    setPendingFilterCallback(null);
    setReplyMessageId(null);
    setSearchButtons({ filters: [], actions: [] });

    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
        signal: searchAbort.signal
      });
      const data = (await res.json()) as SearchSuccessPayload & {
        ok?: boolean;
        message?: string;
        error?: string;
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        applyQuotaFromResponse(data);
        setCaptcha(data.captcha);
        setError(null);
        return;
      }

      if (handleSearchError(res, data)) return;
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "搜索失败");
      }

      setSearchQuery(q);
      applySearchSuccess({ ...data, query: data.query || q }, { freshKeyword: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg =
        err instanceof Error && err.name === "TimeoutError"
          ? "搜索超时，请稍后重试"
          : err instanceof Error
            ? err.message
            : "搜索失败";
      setError(msg);
    } finally {
      clearSearchTimeout();
      if (searchAbortRef.current === searchAbort) {
        searchAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  async function runSearchAction(button: JisouButtonItem) {
    if (!replyMessageId || !button.callback || fromCache) return;

    if (isSupportedJisouFilterCallback(button.callback)) {
      setPendingFilterCallback(button.callback);
    }

    setActionLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyMessageId,
          callback: button.callback,
          text: button.text,
          query: searchQuery
        }),
        signal: AbortSignal.timeout(55000)
      });
      const data = (await res.json()) as SearchSuccessPayload & {
        ok?: boolean;
        message?: string;
        error?: string;
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        setCaptcha(data.captcha);
        setError(data.message || "操作需要人机验证，请选择正确答案");
        return;
      }

      if (handleSearchError(res, data)) {
        setPendingFilterCallback(null);
        return;
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "操作失败");
      }

      applySearchSuccess({ ...data, query: data.query || searchQuery });
    } catch (err) {
      setPendingFilterCallback(null);
      const msg =
        err instanceof Error && err.name === "TimeoutError"
          ? "操作超时，请稍后重试"
          : err instanceof Error
            ? err.message
            : "操作失败";
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  }

  function onChannelClick(channel: JisouChannel) {
    if (isJisouPromotedChannel(channel)) {
      setAdBlockedOpen(true);
      return;
    }
    void loadChannel(channel);
  }

  function closeChannelModal() {
    abortChannelWork();
  }

  async function loadChannel(channel: JisouChannel, inChannelSearch?: string) {
    if (!channel.username) return;

    channelAbortRef.current?.abort();
    const abortController = new AbortController();
    channelAbortRef.current = abortController;

    setActiveChannel(channel);
    setChannelLoading(true);
    setChannelLoadError(null);

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

      const res = await fetch(`${API}/channel?${params.toString()}`, {
        signal: abortController.signal
      });
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
      const initialMessages = data.messages || [];
      setMessages(initialMessages);
      if (!initialMessages.length) {
        setChannelLoadError("频道可读，但当前条件下没有消息");
      } else {
        void prefetchChannelThumbs(channel.username, initialMessages, abortController).then(() => {
          if (!abortController.signal.aborted) {
            void prefetchChannelVideos(channel.username, initialMessages, abortController);
          }
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      setChannelLoadError(err instanceof Error ? err.message : "读取频道失败");
    } finally {
      setChannelLoading(false);
    }
  }

  async function prefetchChannelThumbs(
    username: string,
    initialMessages: ChannelMessageItem[],
    abortController: AbortController
  ) {
    const batchSize = 8;
    const maxRounds = 4;
    let pending = new Set(collectChannelThumbIds(initialMessages));

    async function runWave(waveIds: number[]): Promise<ChannelThumbMap | null> {
      if (!waveIds.length) return null;
      const res = await fetch(`${API}/media/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, messageIds: waveIds, thumb: true }),
        signal: abortController.signal
      });
      const data = (await res.json()) as {
        ok?: boolean;
        media?: ChannelThumbMap;
        partial?: boolean;
      };
      if (abortController.signal.aborted) return null;
      if (res.ok && data.ok && data.media) {
        setMessages((prev) => mergeChannelThumbMap(prev, data.media!));
        return data.media;
      }
      return null;
    }

    try {
      for (let round = 0; round < maxRounds && pending.size > 0; round++) {
        if (abortController.signal.aborted) break;
        const ids = [...pending];
        for (let i = 0; i < ids.length; i += batchSize) {
          if (abortController.signal.aborted) break;
          const waveIds = ids.slice(i, i + batchSize);
          const media = await runWave(waveIds);
          if (!media) continue;
          for (const id of waveIds) {
            const hit = media[String(id)] ?? media[id as unknown as keyof ChannelThumbMap];
            if (hit?.url) pending.delete(id);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  async function prefetchChannelVideos(
    username: string,
    initialMessages: ChannelMessageItem[],
    abortController: AbortController
  ) {
    const ids = collectChannelVideoIds(initialMessages);
    if (!ids.length || abortController.signal.aborted) return;

    const batch = ids.slice(0, 2);
    try {
      await fetch(`${API}/media/warm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, messageIds: batch }),
        signal: abortController.signal
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }

  const hasResults = channels.length > 0 || loading;
  const visibleHistory = historyExpanded ? history : history.slice(0, HISTORY_COLLAPSED);
  const historyHasMore = history.length > HISTORY_COLLAPSED;

  async function searchKeyword(keyword: string) {
    const { controller: searchAbort, clearTimeout: clearSearchTimeout } = beginSearchSession();

    setQuery(keyword);
    setLoading(true);
    setError(null);
    setChannels([]);
    setCaptcha(null);
    setFromCache(false);
    setActiveFilterCallback(null);
    setPendingFilterCallback(null);
    setReplyMessageId(null);
    setSearchButtons({ filters: [], actions: [] });

    try {
      const res = await fetch(`${API}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: keyword }),
        signal: searchAbort.signal
      });
      const data = (await res.json()) as SearchSuccessPayload & {
        ok?: boolean;
        message?: string;
        error?: string;
        captcha?: JisouCaptchaChallenge;
      };

      if (data.captcha && (data.error === "JISOU_CAPTCHA_REQUIRED" || res.status === 428)) {
        applyQuotaFromResponse(data);
        setCaptcha(data.captcha);
        setError(null);
        return;
      }

      if (handleSearchError(res, data)) return;
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || "搜索失败");
      }

      setSearchQuery(keyword);
      applySearchSuccess({ ...data, query: data.query || keyword }, { freshKeyword: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const msg =
        err instanceof Error && err.name === "TimeoutError"
          ? "搜索超时，请稍后重试"
          : err instanceof Error
            ? err.message
            : "搜索失败";
      setError(msg);
    } finally {
      clearSearchTimeout();
      if (searchAbortRef.current === searchAbort) {
        searchAbortRef.current = null;
        setLoading(false);
      }
    }
  }

  const initialSearchDone = useRef(false);
  useEffect(() => {
    const q = initialQuery.trim();
    if (!q || initialSearchDone.current) return;
    initialSearchDone.current = true;
    void searchKeyword(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅 URL 带入的首搜
  }, [initialQuery]);

  return (
    <div className="global-search-body">
      {/* {quota ? (
        <section className="gs-quota-bar" aria-label="今日全网搜索额度">
          <div className="gs-quota-main">
            <p className="gs-quota-title">今日全网搜索额度</p>
            <p className="gs-quota-numbers">
              {quota.hasIdentity ? (
                <>
                  <strong>{quota.remaining}</strong>
                  <span> / {quota.limit}</span>
                </>
              ) : (
                <span className="gs-quota-muted">需先获取身份</span>
              )}
            </p>
            {quota.hasIdentity ? (
              <p className="gs-quota-tip">
                基础每日 {quota.dailyBaseLimit} 次 + 邀请奖励 {quota.searchBonus} 次 · 新关键词返回结果后扣 1 次 · 已搜过的关键词直接读本地缓存
              </p>
            ) : (
              <p className="gs-quota-tip">
                <Link href="/my">前往「我的」获取 GUA 身份</Link> 后即可使用全网搜索
              </p>
            )}
          </div>
        </section>
      ) : null} */}

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
            disabled={loading}
          />
        </div>
        <button type="submit" className="h5-search-submit vip-search-submit" disabled={loading}>
          {loading ? "搜索中" : "搜索"}
        </button>
      </form>

      {history.length > 0 ? (
        <section className="gs-history-tags" aria-label="历史搜索">
          <div className="gs-history-tags-head">
            <h3 className="gs-history-tags-title">历史搜索</h3>
            <button
              type="button"
              className="gs-history-clear"
              onClick={() => setHistoryClearConfirmOpen(true)}
              disabled={historyClearing}
              aria-label="清空历史搜索"
              title="清空历史搜索"
            >
              🗑
            </button>
          </div>
          <div className="gs-history-tags-row">
            {visibleHistory.map((row) => (
              <button
                key={row.keyword}
                type="button"
                className="gs-history-tag"
                onClick={() => void searchKeyword(row.keyword)}
                disabled={loading}
              >
                {row.keyword}
              </button>
            ))}
            {historyHasMore ? (
              <button
                type="button"
                className="gs-history-expand"
                onClick={() => setHistoryExpanded((v) => !v)}
                aria-label={historyExpanded ? "收起" : "展开更多"}
                title={historyExpanded ? "收起" : "展开更多"}
              >
                {historyExpanded ? "▴" : "▾"}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

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

      {error && !captcha && !activeChannel ? <p className="gs-alert">{error}</p> : null}

      {!hasResults && !captcha && !loading ? (
        <section className="gs-empty-intro">
          <div className="gs-empty-icon" aria-hidden>
            🌐
          </div>
          <h2 className="gs-empty-title">搜索暗网全网频道</h2>
          {/* <p className="gs-empty-warn">
          ⚠️⚠️⚠️通过暗网搜索引擎全网搜索，请切勿将其中视频、图片、文字等内容传播、转载至抖音,微信等国内平台
          </p> */}
          <p className="gs-empty-warn">
            ⚠️⚠️⚠️通过暗网搜索引擎使用前请确认您已年满 18 周岁，且自愿浏览可能令人不适的成人向内容。未满 18 岁请立即离开。
          </p>

          <p className="gs-empty-warn">
            ⚠️⚠️⚠️搜索结果可能含色情、等其他限制级(具体结果是按照您的关键词来返回的)敏感内容，请谨慎点击。
          </p>
          <ul className="gs-empty-tips">
            {/* <li>支持定位到索引返回的具体帖子</li>
            <li>点击图片可查看原图，查看原文可阅读完整内容</li>
            <li>每日 {quota?.dailyBaseLimit ?? 5} 次额度，邀请好友可增加</li> */}
            {/* <li>搜索结果可能含色情、血腥等敏感内容，请谨慎点击</li> */}
          </ul>
          {/* <p className="gs-empty-disclaimer">
            <strong>免责声明：</strong>
            本索引内容仅限通过瓜站访问，仅供个人观看与收藏，不得用于任何商业用途。请切勿将其中视频、图片、文字等内容传播、转载至抖音、微信、微博、小红书等国内平台；因用户自行传播所引发的一切法律责任，由用户本人承担，与本站无关。
          </p> */}
        </section>
      ) : null}

      {hasResults ? (
        <section className="gs-panel gs-panel--channels gs-results-panel" aria-label="暗网结果列表">
          <div className="gs-panel-head">
            <h2 className="gs-panel-title">暗网结果</h2>
            <span className="gs-panel-count">{channels.length}</span>
          </div>
          {fromCache ? <p className="gs-cache-hint">已使用本地缓存，不消耗今日额度</p> : null}
          {fromCache && (searchButtons.filters.length > 0 || searchButtons.actions.length > 0) ? (
            <p className="gs-cache-hint gs-cache-hint--muted">缓存结果不支持筛选与翻页，请重新搜索后再操作</p>
          ) : null}

          {(pickSupportedJisouFilterButtons(searchButtons.filters).length > 0 ||
            searchButtons.actions.length > 0) &&
          !loading ? (
            <JisouSearchToolbar
              buttons={searchButtons}
              activeFilterCallback={activeFilterCallback}
              disabled={!toolbarEnabled}
              loading={actionLoading}
              onAction={(btn) => void runSearchAction(btn)}
            />
          ) : null}

          {actionLoading ? <p className="gs-panel-loading">正在更新结果…</p> : null}

          {loading ? (
            <p className="gs-panel-loading">正在全网检索…</p>
          ) : channels.length === 0 ? (
            <p className="gs-panel-muted">暂无频道</p>
          ) : (
            <ul className="gs-channel-list">
              {channels.map((ch) => {
                const opening = channelLoading && activeChannel?.url === ch.url;
                const isAd = isJisouPromotedChannel(ch);
                const { icon: rowIcon, title: rowTitle } = isAd
                  ? { icon: null, title: ch.title }
                  : formatJisouChannelRow(ch, activeFilterType);
                return (
                  <li key={ch.url}>
                    <button
                      type="button"
                      className={`gs-channel-card${opening ? " is-active" : ""}${isAd ? " gs-channel-card--ad" : ""}`}
                      onClick={() => onChannelClick(ch)}
                      disabled={opening && !isAd}
                      aria-label={isAd ? "推广内容，已屏蔽" : rowTitle || ch.title}
                    >
                      <div className="gs-channel-card-main">
                        {isAd ? (
                          <div className="gs-channel-ad-mosaic" aria-hidden="true">
                            <span className="gs-channel-ad-text">{ch.title}</span>
                            {ch.label ? <span className="gs-channel-ad-text gs-channel-ad-text--sub">{ch.label}</span> : null}
                          </div>
                        ) : (
                          <>
                            <span className="gs-channel-title">
                              {rowIcon ? (
                                <span className="gs-result-type-icon" aria-hidden>
                                  {rowIcon}
                                </span>
                              ) : null}
                              {rowTitle}
                            </span>
                            {shouldShowChannelLabel(rowTitle, ch.label) ? (
                              <span className="gs-channel-label">{ch.label}</span>
                            ) : null}
                          </>
                        )}
                      </div>
                      {isAd ? (
                        <div className="gs-channel-meta">
                          <span className="gs-channel-ad-badge">广告 · 已屏蔽</span>
                        </div>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {activeChannel ? (
        <ChannelMessagesModal
          channel={activeChannel}
          activeFilterType={activeFilterType}
          channelMeta={channelMeta}
          channelSearch={channelSearch}
          onChannelSearchChange={setChannelSearch}
          onReload={() => void loadChannel(activeChannel, channelSearch)}
          messages={messages}
          channelLoading={channelLoading}
          loadError={channelLoadError}
          onClose={closeChannelModal}
          onOpenArticle={setArticle}
          anchorRef={anchorRef}
        />
      ) : null}

      {article ? <ArticleModal title={article.title} text={article.text} onClose={() => setArticle(null)} /> : null}
      {adBlockedOpen ? <AdBlockedModal onClose={() => setAdBlockedOpen(false)} /> : null}
      {historyClearConfirmOpen ? (
        <ConfirmModal
          title="清空历史搜索"
          message="确定清空全部历史搜索记录吗？清空后需重新搜索才会再次出现在列表中。"
          confirmLabel="清空"
          pending={historyClearing}
          onCancel={() => {
            if (!historyClearing) setHistoryClearConfirmOpen(false);
          }}
          onConfirm={() => void clearSearchHistory()}
        />
      ) : null}
    </div>
  );
}

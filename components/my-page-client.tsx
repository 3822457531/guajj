"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { GuapiBuyModal } from "@/components/guapi-buy-modal";
import { GuapiHelpButton, GuapiInfoModal } from "@/components/guapi-info-modal";
import { ReferralQrShare } from "@/components/referral-qr-share";
import { VIEW_HISTORY_API } from "@/lib/tg-search-api-paths";
import { buildResourceSharePath } from "@/lib/resource-share";
import {
  buildAbsoluteReferralLink,
  buildReferralLink,
  readGuestIdentityBackup,
  saveGuestIdentityBackup
} from "@/lib/guest-identity-storage";

type MyPageClientProps = {
  publicId: string;
  referrerPublicId: string | null;
  usedToday: number;
  limit: number;
  remaining: number;
  searchBonus: number;
  referralCount: number;
  dailyBaseLimit: number;
  referralBonusPerInvite: number;
};

type ViewHistoryItem = {
  id: string;
  username: string;
  messageId: number;
  title: string | null;
  label: string | null;
  searchQuery: string | null;
  viewedAt: string;
};

function CopyIconButton({
  label,
  text,
  copied,
  onCopy
}: {
  label: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <button type="button" className="my-icon-btn" aria-label={label} title={label} onClick={onCopy}>
      {copied ? "✓" : "⎘"}
    </button>
  );
}

export function MyPageClient(props: MyPageClientProps) {
  const [secretVisible, setSecretVisible] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverPublicId, setRecoverPublicId] = useState("");
  const [recoverSecret, setRecoverSecret] = useState("");
  const [recoverMsg, setRecoverMsg] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [guapiInfoOpen, setGuapiInfoOpen] = useState(false);
  const [guapiBuyOpen, setGuapiBuyOpen] = useState(false);
  const [remaining, setRemaining] = useState(props.remaining);
  const [limit, setLimit] = useState(props.limit);
  const [searchBonus, setSearchBonus] = useState(props.searchBonus);
  const [viewHistory, setViewHistory] = useState<ViewHistoryItem[]>([]);
  const [viewHistoryLoading, setViewHistoryLoading] = useState(true);
  const [viewHistoryClearing, setViewHistoryClearing] = useState(false);

  const refreshViewHistory = useCallback(async () => {
    try {
      const res = await fetch(VIEW_HISTORY_API, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; items?: ViewHistoryItem[] };
      if (data.ok && data.items) setViewHistory(data.items);
    } catch {
      /* ignore */
    } finally {
      setViewHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshViewHistory();
  }, [refreshViewHistory]);

  const clearViewHistory = useCallback(async () => {
    setViewHistoryClearing(true);
    try {
      const res = await fetch(VIEW_HISTORY_API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ all: true })
      });
      if (res.ok) setViewHistory([]);
    } catch {
      /* ignore */
    } finally {
      setViewHistoryClearing(false);
    }
  }, []);

  useEffect(() => {
    const backup = readGuestIdentityBackup();
    setSecretKey(backup?.publicId === props.publicId ? backup.secretKey : null);
  }, [props.publicId]);

  const referralLink = buildReferralLink(props.publicId);
  const quotaPercent = limit > 0 ? Math.min(100, Math.round((remaining / limit) * 100)) : 0;
  const usedToday = Math.max(0, limit - remaining);

  const copyText = useCallback(async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      /* ignore */
    }
  }, []);

  const handleRecover = useCallback(async () => {
    setRecovering(true);
    setRecoverMsg("");
    try {
      const res = await fetch("/api/guest/me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publicId: recoverPublicId.trim(), secretKey: recoverSecret.trim() })
      });
      if (!res.ok) {
        setRecoverMsg("身份或密钥不正确");
        return;
      }
      saveGuestIdentityBackup({
        publicId: recoverPublicId.trim(),
        secretKey: recoverSecret.trim()
      });
      setRecoverMsg("恢复成功，正在刷新…");
      window.location.reload();
    } catch {
      setRecoverMsg("恢复失败，请稍后重试");
    } finally {
      setRecovering(false);
    }
  }, [recoverPublicId, recoverSecret]);

  return (
    <div className="my-page-body">
      <section className="my-hero" aria-label="我的身份与瓜皮">
        <div className="my-hero-glow" aria-hidden />
        <div className="my-hero-top">
          <div className="my-hero-avatar" aria-hidden>
            <span>🍉</span>
          </div>
          <div className="my-hero-id">
            <p className="my-hero-kicker">吃瓜网 · 匿名身份</p>
            <div className="my-profile-id-row">
              <code className="my-profile-id">{props.publicId}</code>
              <CopyIconButton
                label="复制 ID"
                text={props.publicId}
                copied={copiedField === "id"}
                onCopy={() => void copyText("id", props.publicId)}
              />
            </div>
            <p className="my-hero-sub">本地加密 · 换机请备份密钥</p>
          </div>
        </div>

        <div className="my-hero-quota">
          <div className="my-hero-quota-main">
            <div className="my-hero-quota-label">
              <span>今日瓜皮</span>
              <GuapiHelpButton onClick={() => setGuapiInfoOpen(true)} />
            </div>
            <p className="my-hero-quota-num">
              <strong>{remaining}</strong>
              <span className="my-hero-quota-den">/ {limit}</span>
            </p>
            <p className="my-hero-quota-meta">
              已用 {usedToday} · 基础 {props.dailyBaseLimit}/日 · 额外 +{searchBonus}
            </p>
          </div>
          <div
            className="my-quota-ring my-hero-ring"
            style={{ "--my-quota-pct": `${quotaPercent}%` } as CSSProperties}
          >
            <span>{quotaPercent}%</span>
          </div>
        </div>
        <div className="my-quota-bar my-hero-bar" aria-hidden>
          <span className="my-quota-bar-fill" style={{ width: `${quotaPercent}%` }} />
        </div>
        <p className="my-hero-tip">
          {remaining <= 0
            ? `额度已用完。购买瓜皮或邀请好友（每位 +${props.referralBonusPerInvite}），搜索免费、观看才扣。`
            : "搜索免费 · 新资源观看扣 1 瓜皮 · 重复观看不扣"}
        </p>
      </section>

      <nav className="my-action-grid" aria-label="快捷入口">
        <button type="button" className="my-action-tile my-action-tile--primary" onClick={() => setGuapiBuyOpen(true)}>
          <span className="my-action-ico" aria-hidden>
            🍉
          </span>
          <span className="my-action-txt">
            <strong>购买瓜皮</strong>
            <em>微信 / 支付宝</em>
          </span>
        </button>
        <Link href="/agent" prefetch={false} className="my-action-tile my-action-tile--earn">
          <span className="my-action-ico" aria-hidden>
            💰
          </span>
          <span className="my-action-txt">
            <strong>推广赚钱</strong>
            <em>直推间推提成</em>
          </span>
        </Link>
        {/* <Link href="/global-search" prefetch={false} className="my-action-tile">
          <span className="my-action-ico" aria-hidden>
            🔍
          </span>
          <span className="my-action-txt">
            <strong>全网搜索</strong>
            <em>暗网极搜</em>
          </span>
        </Link> */}
      </nav>

      <section className="my-panel my-panel--history" aria-label="观看历史">
        <div className="my-panel-title-row">
          <h2 className="my-panel-title my-panel-title--inline">
            <span className="my-panel-mark" aria-hidden />
            最近吃瓜
          </h2>
          {viewHistory.length > 0 ? (
            <button
              type="button"
              className="my-text-btn"
              disabled={viewHistoryClearing}
              onClick={() => void clearViewHistory()}
            >
              {viewHistoryClearing ? "清空中…" : "清空"}
            </button>
          ) : null}
        </div>
        {viewHistoryLoading ? (
          <p className="my-field-hint">加载中…</p>
        ) : viewHistory.length === 0 ? (
          <div className="my-history-empty">
            <p>还没留下足迹</p>
            <Link href="/global-search" prefetch={false} className="my-history-empty-link">
              去全网搜一波 →
            </Link>
          </div>
        ) : (
          <ul className="my-view-history-list">
            {viewHistory.map((item) => {
              const displayTitle =
                item.title?.trim() || item.label?.trim() || `@${item.username} #${item.messageId}`;
              const href = buildResourceSharePath(item.username, item.messageId);
              const viewedAt = item.viewedAt ? new Date(item.viewedAt).toLocaleString("zh-CN") : "";
              return (
                <li key={item.id} className="my-view-history-item">
                  <Link href={href} prefetch={false} className="my-view-history-link">
                    <span className="my-view-history-title" title={displayTitle}>
                      {displayTitle}
                    </span>
                    <time className="my-view-history-time" dateTime={item.viewedAt}>
                      {viewedAt}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="my-panel my-panel--promo" aria-label="推广奖励">
        <h2 className="my-panel-title">
          <span className="my-panel-mark" aria-hidden />
          拉人吃瓜
        </h2>
        <div className="my-stats-grid">
          <div className="my-stat">
            <span className="my-stat-value">+{searchBonus}</span>
            <span className="my-stat-label">额外瓜皮</span>
          </div>
          <div className="my-stat">
            <span className="my-stat-value">{props.referralCount}</span>
            <span className="my-stat-label">成功邀请</span>
          </div>
          <div className="my-stat my-stat--wide">
            <span className="my-stat-label">我的上级</span>
            <span className="my-stat-inline">{props.referrerPublicId ?? "无（直接访问）"}</span>
          </div>
        </div>
        <p className="my-promo-hint">好友扫码注册，你永久 +{props.referralBonusPerInvite} 瓜皮</p>
        <ReferralQrShare
          publicId={props.publicId}
          referralPath={referralLink}
          copied={copiedField === "link"}
          onCopyLink={() => void copyText("link", buildAbsoluteReferralLink(props.publicId))}
        />
      </section>

      <section className="my-panel my-panel--vault" aria-label="账户凭证">
        <h2 className="my-panel-title">
          <span className="my-panel-mark my-panel-mark--muted" aria-hidden />
          密钥保险箱
        </h2>
        <div className="my-field">
          <span className="my-field-label">本地密钥</span>
          <div className="my-field-row">
            <code className="my-field-value my-field-value--mono">
              {secretKey ? (secretVisible ? secretKey : "••••••••••••••••") : "未在本地找到"}
            </code>
            {secretKey ? (
              <>
                <button type="button" className="my-text-btn" onClick={() => setSecretVisible((v) => !v)}>
                  {secretVisible ? "隐藏" : "显示"}
                </button>
                <CopyIconButton
                  label="复制密钥"
                  text={secretKey}
                  copied={copiedField === "secret"}
                  onCopy={() => void copyText("secret", secretKey)}
                />
              </>
            ) : null}
          </div>
          {!secretKey ? <p className="my-field-hint">清缓存后需用下方恢复；本站无法找回密钥</p> : null}
        </div>

        <div className="my-panel--recover my-recover-inline">
          <button
            type="button"
            className="my-recover-toggle"
            aria-expanded={recoverOpen}
            onClick={() => setRecoverOpen((v) => !v)}
          >
            <span className="my-recover-toggle-label">换机恢复身份</span>
            <span className="my-recover-chevron" aria-hidden>
              {recoverOpen ? "▾" : "▸"}
            </span>
          </button>
          {recoverOpen ? (
            <div className="my-recover-body">
              <p className="my-recover-desc">输入 ID 与密钥即可恢复（请提前备份）。</p>
              <div className="my-recover-fields">
                <input
                  type="text"
                  placeholder="GUA-123456"
                  value={recoverPublicId}
                  onChange={(e) => setRecoverPublicId(e.target.value)}
                  className="my-recover-input"
                  autoComplete="off"
                />
                <input
                  type="text"
                  placeholder="sk_xxxx_xxxx_xxxx_mxp"
                  value={recoverSecret}
                  onChange={(e) => setRecoverSecret(e.target.value)}
                  className="my-recover-input"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="my-recover-btn"
                disabled={recovering}
                onClick={() => void handleRecover()}
              >
                {recovering ? "恢复中…" : "恢复身份"}
              </button>
              {recoverMsg ? <p className="my-recover-msg">{recoverMsg}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <GuapiInfoModal open={guapiInfoOpen} onClose={() => setGuapiInfoOpen(false)} />
      <GuapiBuyModal
        open={guapiBuyOpen}
        onClose={() => setGuapiBuyOpen(false)}
        onPaid={(quota) => {
          setRemaining(quota.remaining);
          setLimit(quota.limit);
          setSearchBonus(quota.searchBonus);
          setTimeout(() => setGuapiBuyOpen(false), 1200);
        }}
      />
    </div>
  );
}

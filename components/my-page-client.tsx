"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
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
  const quotaPercent = props.limit > 0 ? Math.min(100, Math.round((props.remaining / props.limit) * 100)) : 0;

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
      <section className="my-profile-card" aria-label="我的身份">
        <div className="my-profile-avatar" aria-hidden>
          🍉
        </div>
        <div className="my-profile-main">
          <p className="my-profile-label">匿名加密身份</p>
          <div className="my-profile-id-row">
            <code className="my-profile-id">{props.publicId}</code>
            <CopyIconButton
              label="复制 ID"
              text={props.publicId}
              copied={copiedField === "id"}
              onCopy={() => void copyText("id", props.publicId)}
            />
          </div>
          <span className="my-profile-badge">ENCRYPTED · 本地存储</span>
        </div>
      </section>

      <section className="my-quota-card" aria-label="今日瓜皮余额">
        <div className="my-quota-head">
          <div>
            <p className="my-quota-title">今日瓜皮余额</p>
            <p className="my-quota-numbers">
              剩余 <strong>{props.remaining}</strong>
              <span> / {props.limit}</span>
              <span className="my-quota-unit">
                瓜皮
                <GuapiHelpButton onClick={() => setGuapiInfoOpen(true)} />
              </span>
            </p>
          </div>
          <div className="my-quota-ring" style={{ "--my-quota-pct": `${quotaPercent}%` } as CSSProperties}>
            <span>{quotaPercent}%</span>
          </div>
        </div>
        <div className="my-quota-bar" aria-hidden>
          <span className="my-quota-bar-fill" style={{ width: `${quotaPercent}%` }} />
        </div>
          <p className="my-quota-tip">
          {props.remaining <= 0
            ? `瓜皮已用完。邀请好友每位 +${props.referralBonusPerInvite} 瓜皮（基础 ${props.dailyBaseLimit}/日），搜索不扣瓜皮，重复观看同一资源不扣瓜皮。`
            : `基础 ${props.dailyBaseLimit} 瓜皮/日 + 邀请奖励 ${props.searchBonus} 瓜皮 · 搜索免费 · 点进观看扣 1 瓜皮 · 重复观看不扣`}
        </p>
        <div className="my-quota-links">
          <Link href="/global-search" prefetch={false} className="my-quota-link">
            去全网搜索 →
          </Link>
        </div>
      </section>

      <section className="my-panel" aria-label="观看历史">
        <div className="my-panel-title-row">
          <h2 className="my-panel-title my-panel-title--inline">观看历史</h2>
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
          <p className="my-field-hint">暂无观看记录，在全网搜索点进资源后会显示在这里</p>
        ) : (
          <ul className="my-view-history-list">
            {viewHistory.map((item) => {
              const displayTitle = item.title?.trim() || `@${item.username} #${item.messageId}`;
              const href = buildResourceSharePath(item.username, item.messageId, {
                title: item.title,
                label: item.label
              });
              const viewedAt = item.viewedAt ? new Date(item.viewedAt).toLocaleString("zh-CN") : "";
              return (
                <li key={item.id} className="my-view-history-item">
                  <Link href={href} prefetch={false} className="my-view-history-link">
                    <span className="my-view-history-title">{displayTitle}</span>
                    {item.label ? <span className="my-view-history-label">{item.label}</span> : null}
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

      <section className="my-panel" aria-label="账户凭证">
        <h2 className="my-panel-title">账户凭证</h2>
        <div className="my-field">
          <span className="my-field-label">密钥</span>
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
          {!secretKey ? <p className="my-field-hint">请使用下方「密钥恢复」找回本地密钥</p> : null}
        </div>
      </section>

      <section className="my-panel my-panel--promo" aria-label="推广奖励">
        <h2 className="my-panel-title">推广奖励</h2>
        <div className="my-stats-grid">
          <div className="my-stat">
            <span className="my-stat-value">+{props.searchBonus}</span>
            <span className="my-stat-label">邀请奖励瓜皮</span>
          </div>
          <div className="my-stat">
            <span className="my-stat-value">{props.referralCount}</span>
            <span className="my-stat-label">成功邀请</span>
          </div>
          <div className="my-stat my-stat--wide">
            <span className="my-stat-label">推广人</span>
            <span className="my-stat-inline">{props.referrerPublicId ?? "无（直接访问）"}</span>
          </div>
        </div>

        <ReferralQrShare
          publicId={props.publicId}
          referralPath={referralLink}
          copied={copiedField === "link"}
          onCopyLink={() => void copyText("link", buildAbsoluteReferralLink(props.publicId))}
        />
      </section>

      <section className="my-panel my-panel--recover">
        <button
          type="button"
          className="my-recover-toggle"
          aria-expanded={recoverOpen}
          onClick={() => setRecoverOpen((v) => !v)}
        >
          <span className="my-panel-title my-panel-title--inline">密钥恢复</span>
          <span className="my-recover-chevron" aria-hidden>
            {recoverOpen ? "▾" : "▸"}
          </span>
        </button>
        {recoverOpen ? (
          <div className="my-recover-body">
            <p className="my-recover-desc">换设备或清缓存后，输入 ID 与密钥恢复身份（本站无数据库找回）。</p>
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
            <button type="button" className="my-recover-btn" disabled={recovering} onClick={() => void handleRecover()}>
              {recovering ? "恢复中…" : "恢复身份"}
            </button>
            {recoverMsg ? <p className="my-recover-msg">{recoverMsg}</p> : null}
          </div>
        ) : (
          <p className="my-recover-collapsed">丢失密钥？点此展开恢复</p>
        )}
      </section>

      <GuapiInfoModal open={guapiInfoOpen} onClose={() => setGuapiInfoOpen(false)} />
    </div>
  );
}

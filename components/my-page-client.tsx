"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import {
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

      <section className="my-quota-card" aria-label="今日全网搜索额度">
        <div className="my-quota-head">
          <div>
            <p className="my-quota-title">今日全网搜索</p>
            <p className="my-quota-numbers">
              剩余 <strong>{props.remaining}</strong>
              <span> / {props.limit} 次</span>
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
            ? `次数已用完。邀请好友每位 +${props.referralBonusPerInvite} 次（基础 ${props.dailyBaseLimit} 次/日），已搜关键词可走缓存。`
            : `基础 ${props.dailyBaseLimit} 次/日 + 邀请奖励 ${props.searchBonus} 次 · 重复关键词不扣次`}
        </p>
        <Link href="/global-search" prefetch={false} className="my-quota-link">
          去全网搜索 →
        </Link>
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

      <section className="my-panel" aria-label="推广奖励">
        <h2 className="my-panel-title">推广奖励</h2>
        <div className="my-stats-grid">
          <div className="my-stat">
            <span className="my-stat-value">+{props.searchBonus}</span>
            <span className="my-stat-label">邀请奖励次数</span>
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
        <div className="my-field my-field--link">
          <span className="my-field-label">推广链接</span>
          <div className="my-field-row">
            <code className="my-field-value my-field-value--link">{referralLink}</code>
            <CopyIconButton
              label="复制推广链接"
              text={referralLink}
              copied={copiedField === "link"}
              onCopy={() => void copyText("link", referralLink)}
            />
          </div>
          <p className="my-field-hint">好友通过链接注册后，你将获得额外搜索次数</p>
        </div>
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
    </div>
  );
}

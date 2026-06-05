"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildReferralLink,
  readGuestIdentityBackup,
  saveGuestIdentityBackup,
  type GuestIdentityBackup
} from "@/lib/guest-identity-storage";

type GuestIdentityModalProps = {
  onComplete: () => void;
  initialRef?: string | null;
};

export function GuestIdentityModal({ onComplete, initialRef }: GuestIdentityModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [identity, setIdentity] = useState<GuestIdentityBackup | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedImage, setSavedImage] = useState(false);

  const canEnter = copied || savedImage;

  useEffect(() => {
    let cancelled = false;

    async function register() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/guest/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(initialRef ? { ref: initialRef } : {})
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error("注册失败，请刷新重试");
        }
        if (data.alreadyRegistered) {
          const backup = readGuestIdentityBackup();
          if (backup?.publicId === data.publicId) {
            if (!cancelled) {
              setIdentity(backup);
              setLoading(false);
            }
            return;
          }
          if (!cancelled) {
            setError("身份已存在，但本地未找到密钥备份。如已保存密钥，请前往「我的」页面恢复。");
            setLoading(false);
          }
          return;
        }
        const next: GuestIdentityBackup = {
          publicId: data.publicId,
          secretKey: data.secretKey
        };
        saveGuestIdentityBackup(next);
        if (!cancelled) {
          setIdentity(next);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "注册失败");
          setLoading(false);
        }
      }
    }

    void register();
    return () => {
      cancelled = true;
    };
  }, [initialRef]);

  const copyAll = useCallback(async () => {
    if (!identity) return;
    const text = `吃瓜网 · 匿名加密身份\n\n您的 ID：${identity.publicId}\n您的密钥：${identity.secretKey}\n\n推广链接：${buildReferralLink(identity.publicId)}\n\n身份信息已加密保存在您的浏览器中。如更换设备或清理缓存，请使用密钥找回。本站无数据库找回功能，请务必妥善保管。`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setError("复制失败，请手动长按选择复制");
    }
  }, [identity]);

  const saveAsImage = useCallback(() => {
    if (!identity) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 420;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");

      ctx.fillStyle = "#0d1117";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ff5722";
      ctx.fillRect(0, 0, canvas.width, 4);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("🍉 吃瓜网 · 匿名加密身份", 32, 48);

      ctx.fillStyle = "#9e9e9e";
      ctx.font = "14px sans-serif";
      ctx.fillText("ENCRYPTED ID", 32, 72);

      ctx.fillStyle = "#bdbdbd";
      ctx.font = "13px sans-serif";
      ctx.fillText("您的 ID", 32, 120);
      ctx.fillStyle = "#ffd54f";
      ctx.font = "bold 28px monospace";
      ctx.fillText(identity.publicId, 32, 158);

      ctx.fillStyle = "#bdbdbd";
      ctx.font = "13px sans-serif";
      ctx.fillText("您的密钥", 32, 210);
      ctx.fillStyle = "#80cbc4";
      ctx.font = "18px monospace";
      ctx.fillText(identity.secretKey, 32, 242);

      ctx.fillStyle = "#757575";
      ctx.font = "12px sans-serif";
      const foot =
        "身份信息已加密保存在浏览器中。清理缓存后请用密钥找回。";
      ctx.fillText(foot, 32, 300);

      const link = document.createElement("a");
      link.download = `${identity.publicId}-identity.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setSavedImage(true);
    } catch {
      setError("保存图片失败，请使用复制功能");
    }
  }, [identity]);

  return (
    <div className="guest-id-overlay" role="dialog" aria-modal="true" aria-labelledby="guest-id-title">
      <div className="guest-id-modal">
        <div className="guest-id-glow" aria-hidden />
        <header className="guest-id-head">
          <span className="guest-id-badge" aria-hidden>
            🔐
          </span>
          <h2 id="guest-id-title" className="guest-id-title">
            匿名加密身份
          </h2>
          <p className="guest-id-sub">
            由于内容特殊，本站不记录任何个人信息。系统已为你生成专属加密身份。
          </p>
        </header>

        {loading ? (
          <div className="guest-id-loading">
            <span className="guest-id-spinner" aria-hidden />
            <p>正在生成加密身份…</p>
          </div>
        ) : error && !identity ? (
          <div className="guest-id-error">
            <p>{error}</p>
            <button type="button" className="guest-id-btn guest-id-btn--primary" onClick={() => window.location.reload()}>
              重试
            </button>
          </div>
        ) : identity ? (
          <>
            <div className="guest-id-card">
              <div className="guest-id-card-head">
                <span className="guest-id-card-logo">🍉 吃瓜网</span>
                <span className="guest-id-card-tag">ENCRYPTED ID</span>
              </div>
              <div className="guest-id-field">
                <span className="guest-id-label">您的 ID</span>
                <code className="guest-id-value">{identity.publicId}</code>
              </div>
              <div className="guest-id-field">
                <span className="guest-id-label">您的密钥</span>
                <code className="guest-id-value guest-id-value--secret">{identity.secretKey}</code>
              </div>
              <p className="guest-id-card-foot">
                身份信息已加密保存在您的浏览器中。如更换设备或清理缓存，请使用密钥找回。本站无数据库找回功能，请务必妥善保管。
              </p>
            </div>

            {error ? <p className="guest-id-inline-err">{error}</p> : null}

            <div className="guest-id-actions">
              <button type="button" className="guest-id-btn guest-id-btn--outline" onClick={() => void copyAll()}>
                {copied ? "✓ 已复制" : "一键复制身份"}
              </button>
              <button type="button" className="guest-id-btn guest-id-btn--outline" onClick={() => void saveAsImage()}>
                {savedImage ? "✓ 已保存" : "保存为图片"}
              </button>
            </div>

            <button
              type="button"
              className={`guest-id-btn guest-id-btn--primary guest-id-btn--enter${canEnter ? " is-ready" : ""}`}
              disabled={!canEnter}
              onClick={onComplete}
            >
              {canEnter ? "进入吃瓜网" : "请先复制或保存身份"}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

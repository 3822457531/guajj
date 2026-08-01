"use client";

import { useCallback, useRef, useState } from "react";
import { buildResourceShareText } from "@/lib/resource-share";
import { readCurrentShareReferrerId } from "@/lib/resource-share-client";

type GuapiQuotaBlockedModalProps = {
  open: boolean;
  onClose: () => void;
  message?: string | null;
  used?: number;
  limit?: number;
  username?: string | null;
  messageId?: number | null;
  title?: string | null;
  referrerPublicId?: string | null;
  onShareCopied?: () => void;
  onBuy: () => void;
};

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function GuapiQuotaBlockedModal({
  open,
  onClose,
  message,
  used,
  limit,
  username,
  messageId,
  title,
  referrerPublicId,
  onShareCopied,
  onBuy
}: GuapiQuotaBlockedModalProps) {
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const busyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const handleShare = useCallback(async () => {
    if (busyRef.current) return;
    if (!username || !messageId) {
      setShareState("failed");
      return;
    }
    busyRef.current = true;
    const ref = readCurrentShareReferrerId(referrerPublicId);
    const shareText = buildResourceShareText(username, messageId, title, { ref });
    const ok = await copyToClipboard(shareText);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (ok) {
      setShareState("copied");
      onShareCopied?.();
      timerRef.current = window.setTimeout(() => setShareState("idle"), 2200);
    } else {
      setShareState("failed");
      timerRef.current = window.setTimeout(() => setShareState("idle"), 2200);
    }
    busyRef.current = false;
  }, [username, messageId, title, referrerPublicId, onShareCopied]);

  if (!open) return null;

  const quotaText =
    typeof used === "number" && typeof limit === "number"
      ? `今日已用 ${used} / ${limit} 瓜皮`
      : "今日瓜皮已用完";

  return (
    <div className="guapi-quota-modal" role="dialog" aria-modal="true" aria-labelledby="guapi-quota-title">
      <button type="button" className="guapi-quota-modal-backdrop" onClick={onClose} aria-label="关闭" />
      <div className="guapi-quota-modal-panel">
        <div className="guapi-quota-modal-head">
          <div className="guapi-quota-modal-icon" aria-hidden>
            🍉
          </div>
          <div className="guapi-quota-modal-head-text">
            <h3 id="guapi-quota-title" className="guapi-quota-modal-title">
              瓜皮不足
            </h3>
            <p className="guapi-quota-modal-sub">{quotaText}</p>
          </div>
          <button type="button" className="guapi-quota-modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="guapi-quota-modal-body">
          <p className="guapi-quota-modal-desc">
            {message?.trim() || "无法继续观看资源。可分享当前链接邀请好友增加额度，或购买瓜皮立即恢复。"}
          </p>
          <div className="guapi-quota-modal-actions">
            <button
              type="button"
              className={`guapi-quota-btn guapi-quota-btn--share${
                shareState === "copied" ? " is-copied" : shareState === "failed" ? " is-failed" : ""
              }`}
              onClick={() => void handleShare()}
              disabled={!username || !messageId}
            >
              {shareState === "copied" ? "已复制链接" : shareState === "failed" ? "复制失败" : "去分享"}
            </button>
            <button type="button" className="guapi-quota-btn guapi-quota-btn--buy" onClick={onBuy}>
              去购买
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

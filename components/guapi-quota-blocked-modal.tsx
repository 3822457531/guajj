"use client";

import { useCallback, useRef, useState } from "react";
import { readCurrentShareReferrerId, shareResourceNative } from "@/lib/resource-share-client";

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
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "failed">("idle");
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
    const result = await shareResourceNative({
      username,
      messageId,
      title,
      options: { ref }
    });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (result === "shared" || result === "copied") {
      setShareState(result);
      onShareCopied?.();
      timerRef.current = window.setTimeout(() => setShareState("idle"), 2200);
    } else if (result === "failed") {
      setShareState("failed");
      timerRef.current = window.setTimeout(() => setShareState("idle"), 2200);
    } else {
      setShareState("idle");
    }
    busyRef.current = false;
  }, [username, messageId, title, referrerPublicId, onShareCopied]);

  if (!open) return null;

  const quotaText =
    typeof used === "number" && typeof limit === "number"
      ? `已用 ${used} / 累计 ${limit} 瓜皮`
      : "瓜皮不足";

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
            {message?.trim() ||
              "预览结束，瓜皮不足无法继续。可签到领取、分享邀请好友，或购买瓜皮。"}
          </p>
          <div className="guapi-quota-modal-actions">
            <button
              type="button"
              className={`guapi-quota-btn guapi-quota-btn--share${
                shareState === "shared" || shareState === "copied"
                  ? " is-copied"
                  : shareState === "failed"
                    ? " is-failed"
                    : ""
              }`}
              onClick={() => void handleShare()}
              disabled={!username || !messageId}
            >
              {shareState === "shared"
                ? "已分享"
                : shareState === "copied"
                  ? "已复制链接"
                  : shareState === "failed"
                    ? "分享失败"
                    : "去分享"}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { buildAbsoluteReferralLink } from "@/lib/guest-identity-storage";

type ReferralQrShareProps = {
  publicId: string;
  referralPath: string;
  copied: boolean;
  onCopyLink: () => void;
};

export function ReferralQrShare({ publicId, referralPath, copied, onCopyLink }: ReferralQrShareProps) {
  const [absoluteUrl, setAbsoluteUrl] = useState(referralPath);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    setAbsoluteUrl(buildAbsoluteReferralLink(publicId));
  }, [publicId, referralPath]);

  const handleShare = useCallback(async () => {
    const text = `吃瓜网 · 扫码注册领瓜皮\n${absoluteUrl}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "吃瓜网邀请",
          text: "扫码注册，一起搜吃瓜、领暗网手机号额度",
          url: absoluteUrl
        });
        return;
      } catch {
        /* 用户取消或不可用 */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg("已复制分享文案");
      setTimeout(() => setShareMsg(""), 2000);
    } catch {
      setShareMsg("复制失败，请手动复制链接");
    }
  }, [absoluteUrl]);

  return (
    <div className="my-referral-share">
      <div className="my-referral-qr-wrap" aria-label="推广二维码">
        <QRCode
          value={absoluteUrl}
          size={128}
          level="M"
          bgColor="#141414"
          fgColor="#ffffff"
          style={{ width: "100%", height: "auto", maxWidth: 128 }}
        />
        <p className="my-referral-qr-hint">微信 / 浏览器扫码注册</p>
      </div>

      <div className="my-referral-link-col">
        <span className="my-field-label">推广链接</span>
        <div className="my-field-row">
          <code className="my-field-value my-field-value--link">{referralPath}</code>
          <button
            type="button"
            className="my-icon-btn"
            aria-label="复制推广链接"
            title="复制推广链接"
            onClick={onCopyLink}
          >
            {copied ? "✓" : "⎘"}
          </button>
        </div>
        <p className="my-field-hint">好友扫码或打开链接注册后，你将获得额外瓜皮</p>
        <div className="my-referral-actions">
          <button type="button" className="my-referral-share-btn" onClick={() => void handleShare()}>
            分享邀请
          </button>
          {shareMsg ? <span className="my-referral-share-msg">{shareMsg}</span> : null}
        </div>
      </div>
    </div>
  );
}

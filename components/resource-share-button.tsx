"use client";

import { useCallback, useRef, useState } from "react";
import { readCurrentShareReferrerId, shareResourceNative } from "@/lib/resource-share-client";

type ResourceShareButtonProps = {
  username: string;
  messageId: number;
  title?: string | null;
  label?: string | null;
  /** 可选；不传则自动读本地 GUA 身份 */
  referrerPublicId?: string | null;
};

export function ResourceShareButton({
  username,
  messageId,
  title,
  referrerPublicId
}: ResourceShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "shared" | "copied" | "failed">("idle");
  const busyRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  const handleShare = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (busyRef.current) return;
      busyRef.current = true;

      const ref = readCurrentShareReferrerId(referrerPublicId);
      const result = await shareResourceNative({
        username,
        messageId,
        title,
        options: { ref }
      });

      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);

      if (result === "shared") {
        setStatus("shared");
        resetTimerRef.current = window.setTimeout(() => setStatus("idle"), 2200);
      } else if (result === "copied") {
        setStatus("copied");
        resetTimerRef.current = window.setTimeout(() => setStatus("idle"), 2200);
      } else if (result === "failed") {
        setStatus("failed");
        resetTimerRef.current = window.setTimeout(() => setStatus("idle"), 2200);
      } else {
        // cancelled：保持 idle
        setStatus("idle");
      }

      busyRef.current = false;
    },
    [username, messageId, title, referrerPublicId]
  );

  const labelText =
    status === "shared" ? "已分享" : status === "copied" ? "已复制" : status === "failed" ? "分享失败" : "分享";

  return (
    <button
      type="button"
      className={`gs-resource-share-btn${status === "shared" || status === "copied" ? " is-copied" : ""}${
        status === "failed" ? " is-failed" : ""
      }`}
      aria-label={labelText}
      title="分享到微信 / QQ 等（系统面板）"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => void handleShare(e)}
    >
      <span className="gs-resource-share-icon" aria-hidden>
        {status === "shared" || status === "copied" ? "✓" : status === "failed" ? "!" : "⎘"}
      </span>
      <span className="gs-resource-share-label">{labelText}</span>
    </button>
  );
}

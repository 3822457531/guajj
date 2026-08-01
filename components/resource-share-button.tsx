"use client";

import { useCallback, useRef, useState } from "react";
import {
  buildAbsoluteResourceShareUrl,
  truncateShareDisplayTitle
} from "@/lib/resource-share";

type ResourceShareButtonProps = {
  username: string;
  messageId: number;
  title?: string | null;
  label?: string | null;
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

export function ResourceShareButton({ username, messageId, title }: ResourceShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);
  const resetTimerRef = useRef<number | null>(null);

  const handleShare = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (busyRef.current) return;
      busyRef.current = true;

      const url = buildAbsoluteResourceShareUrl(username, messageId);
      const displayTitle = truncateShareDisplayTitle(title?.trim() || `@${username}`);
      const shareText = `吃瓜网 · ${displayTitle}\n${url}`;

      const ok = await copyToClipboard(shareText);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);

      if (ok) {
        setFailed(false);
        setCopied(true);
        resetTimerRef.current = window.setTimeout(() => setCopied(false), 2200);
      } else {
        setCopied(false);
        setFailed(true);
        resetTimerRef.current = window.setTimeout(() => setFailed(false), 2200);
      }

      busyRef.current = false;
    },
    [username, messageId, title]
  );

  return (
    <button
      type="button"
      className={`gs-resource-share-btn${copied ? " is-copied" : ""}${failed ? " is-failed" : ""}`}
      aria-label={copied ? "已复制分享链接" : failed ? "复制失败" : "复制分享链接"}
      title="复制分享链接"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => void handleShare(e)}
    >
      <span className="gs-resource-share-icon" aria-hidden>
        {copied ? "✓" : failed ? "!" : "⎘"}
      </span>
      <span className="gs-resource-share-label">{copied ? "已复制" : failed ? "复制失败" : "分享"}</span>
    </button>
  );
}

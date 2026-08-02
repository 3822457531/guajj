"use client";

import { readGuestIdentityBackup } from "@/lib/guest-identity-storage";
import {
  buildAbsoluteResourceShareUrl,
  buildResourceShareText,
  isShareReferrerId,
  truncateShareDisplayTitle,
  type ResourceShareOptions
} from "@/lib/resource-share";

/** 读取当前登录/本地备份的 GUA ID，供分享链接写入 ref */
export function readCurrentShareReferrerId(explicit?: string | null): string | null {
  if (isShareReferrerId(explicit)) return explicit.trim();
  const backup = readGuestIdentityBackup();
  if (backup && isShareReferrerId(backup.publicId)) return backup.publicId;
  return null;
}

export type NativeShareResult = "shared" | "copied" | "cancelled" | "failed";

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

function canUseNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * 优先调起系统分享面板（手机上可选微信/QQ/抖音等已安装 App），
 * 不支持或用户取消后降级为复制链接。
 * 注意：H5 无法用自定义按钮直接协议唤起微信/抖音并预填分享内容。
 */
export async function shareResourceNative(input: {
  username: string;
  messageId: number;
  title?: string | null;
  options?: ResourceShareOptions;
}): Promise<NativeShareResult> {
  const ref = input.options?.ref ?? null;
  const url = buildAbsoluteResourceShareUrl(input.username, input.messageId, { ref });
  const displayTitle = truncateShareDisplayTitle(input.title?.trim() || `@${input.username}`);
  const text = buildResourceShareText(input.username, input.messageId, input.title, { ref });

  if (canUseNativeShare()) {
    try {
      await navigator.share({
        title: `吃瓜网 · ${displayTitle}`,
        text: `吃瓜网 · ${displayTitle}`,
        url
      });
      return "shared";
    } catch (err) {
      // 用户关闭系统面板
      if (err instanceof DOMException && err.name === "AbortError") {
        return "cancelled";
      }
      // 部分环境 share 失败，继续复制降级
    }
  }

  const ok = await copyToClipboard(text);
  return ok ? "copied" : "failed";
}
